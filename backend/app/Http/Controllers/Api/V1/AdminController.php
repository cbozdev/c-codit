<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\TransactionResource;
use App\Http\Resources\UserResource;
use App\Models\Payment;
use App\Models\Service;
use App\Models\Transaction;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\Audit;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function users(Request $request)
    {
        $request->validate(['per_page' => ['nullable', 'integer', 'min:1', 'max:200'], 'q' => ['nullable', 'string']]);

        $q = User::query()->orderByDesc('id');
        if ($s = $request->input('q')) {
            $q->where(fn ($w) => $w->where('email', 'ilike', "%{$s}%")->orWhere('name', 'ilike', "%{$s}%"));
        }
        $page = $q->paginate((int) ($request->input('per_page') ?? 25));

        return ApiResponse::ok([
            'items' => UserResource::collection($page->items()),
            'meta'  => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'total'        => $page->total(),
            ],
        ]);
    }

    public function suspendUser(Request $request, string $publicId)
    {
        $request->validate(['reason' => ['required', 'string', 'max:255']]);
        $user = User::where('public_id', $publicId)->firstOrFail();
        $user->update(['is_suspended' => true, 'suspension_reason' => $request->input('reason')]);
        $user->tokens()->delete();
        Audit::log('admin.user_suspended', $user, ['reason' => $request->input('reason')], actorType: 'admin');
        return ApiResponse::ok(null, 'User suspended.');
    }

    public function unsuspendUser(string $publicId)
    {
        $user = User::where('public_id', $publicId)->firstOrFail();
        $user->update(['is_suspended' => false, 'suspension_reason' => null]);
        Audit::log('admin.user_unsuspended', $user, [], actorType: 'admin');
        return ApiResponse::ok(null, 'User unsuspended.');
    }

    public function transactions(Request $request)
    {
        $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'status'   => ['nullable', 'string'],
            'type'     => ['nullable', 'string'],
        ]);

        $q = Transaction::query()->orderByDesc('id');
        if ($s = $request->input('status')) $q->where('status', $s);
        if ($t = $request->input('type'))   $q->where('type', $t);
        $page = $q->paginate((int) ($request->input('per_page') ?? 50));

        return ApiResponse::ok([
            'items' => TransactionResource::collection($page->items()),
            'meta'  => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'total'        => $page->total(),
            ],
        ]);
    }

    public function metrics()
    {
        $todayStart = now()->startOfDay();
        $stats = [
            'users_total'              => User::count(),
            'users_active_24h'         => User::where('last_login_at', '>=', $todayStart->copy()->subDay())->count(),
            'transactions_today'       => Transaction::where('created_at', '>=', $todayStart)->count(),
            'transactions_success_24h' => Transaction::where('status', 'success')->where('created_at', '>=', $todayStart->copy()->subDay())->count(),
            'transactions_failed_24h'  => Transaction::where('status', 'failed')->where('created_at', '>=', $todayStart->copy()->subDay())->count(),
            'payments_pending'         => Payment::whereIn('status', ['initiated', 'pending'])->count(),
            'gmv_today_minor'          => (int) Transaction::where('type', 'service_purchase')->where('status', 'success')->where('created_at', '>=', $todayStart)->sum('amount_minor'),
            'wallet_funding_today_minor' => (int) Transaction::where('type', 'wallet_funding')->where('status', 'success')->where('created_at', '>=', $todayStart)->sum('amount_minor'),
        ];
        return ApiResponse::ok($stats);
    }

    public function toggleService(Request $request, string $code)
    {
        $request->validate(['is_active' => ['required', 'boolean']]);
        $svc = Service::where('code', $code)->firstOrFail();
        $svc->update(['is_active' => (bool) $request->input('is_active')]);
        Audit::log('admin.service_toggled', $svc, ['is_active' => $svc->is_active], actorType: 'admin');
        return ApiResponse::ok(null, 'Service updated.');
    }

    public function toggleUserRole(Request $request, string $publicId)
    {
        $request->validate(['role' => ['required', 'string', 'in:admin,user']]);

        $user = User::where('public_id', $publicId)->firstOrFail();

        // Prevent demoting yourself
        if ($user->id === $request->user()->id) {
            return ApiResponse::fail('You cannot change your own role.', null, 403);
        }

        $newRole = $request->input('role');
        $oldRole = $user->getRoleNames()->first() ?? 'user';

        // Remove all roles and assign the new one
        $user->syncRoles([$newRole]);

        Audit::log('admin.user_role_changed', $user, [
            'from' => $oldRole,
            'to'   => $newRole,
        ], actorType: 'admin');

        return ApiResponse::ok(null, "User role updated to {$newRole}.");
    }
}
