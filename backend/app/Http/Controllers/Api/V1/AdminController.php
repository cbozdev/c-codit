<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Http\Controllers\Controller;
use App\Http\Resources\ServiceResource;
use App\Http\Resources\TransactionResource;
use App\Http\Resources\UserResource;
use App\Models\Payment;
use App\Models\Service;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Ledger\ChartOfAccounts;
use App\Services\Wallet\WalletService;
use App\Support\ApiResponse;
use App\Support\Audit;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    public function __construct(private readonly WalletService $wallets) {}

    // ─── Users ───────────────────────────────────────────────────────────────

    public function users(Request $request)
    {
        $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'q'        => ['nullable', 'string'],
        ]);

        $q = User::with('wallet')->orderByDesc('id');
        if ($s = $request->input('q')) {
            $q->where(fn ($w) =>
                $w->where('email', 'ilike', "%{$s}%")
                  ->orWhere('name',  'ilike', "%{$s}%")
            );
        }
        $page = $q->paginate((int) ($request->input('per_page') ?? 25));

        // Attach balance to each user resource
        $items = collect($page->items())->map(fn (User $u) => array_merge(
            (new UserResource($u))->resolve(),
            [
                'balance_minor'  => (int) ($u->wallet?->balance_minor ?? 0),
                'balance'        => number_format(($u->wallet?->balance_minor ?? 0) / 100, 2),
                'wallet_frozen'  => (bool) ($u->wallet?->is_frozen ?? false),
                'registered_at'  => $u->created_at?->toIso8601String(),
            ]
        ));

        return ApiResponse::ok([
            'items' => $items,
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

    public function toggleUserRole(Request $request, string $publicId)
    {
        $request->validate(['role' => ['required', 'string', 'in:admin,user']]);
        $user = User::where('public_id', $publicId)->firstOrFail();

        if ($user->id === $request->user()->id) {
            return ApiResponse::fail('You cannot change your own role.', null, 403);
        }

        $newRole = $request->input('role');
        $oldRole = $user->getRoleNames()->first() ?? 'user';
        $user->syncRoles([$newRole]);

        Audit::log('admin.user_role_changed', $user, [
            'from' => $oldRole,
            'to'   => $newRole,
        ], actorType: 'admin');

        return ApiResponse::ok(null, "User role updated to {$newRole}.");
    }

    /**
     * Manually adjust a user's wallet (credit or debit).
     * Uses WalletService so it goes through the ledger properly.
     */
    public function adjustWallet(Request $request, string $publicId)
    {
        $request->validate([
            'direction' => ['required', 'in:credit,debit'],
            'amount'    => ['required', 'numeric', 'min:0.01', 'max:10000'],
            'reason'    => ['required', 'string', 'min:5', 'max:255'],
        ]);

        $user   = User::where('public_id', $publicId)->with('wallet')->firstOrFail();
        $wallet = $user->wallet ?? $this->wallets->getOrCreate($user);
        $amount = Money::fromDecimal((string) $request->input('amount'), $wallet->currency);
        $admin  = $request->user();

        $idempotencyKey = 'admin_adj:' . $admin->id . ':' . $publicId . ':' . now()->timestamp;

        if ($request->input('direction') === 'credit') {
            $tx = $this->wallets->fundFromPayment(
                wallet: $wallet,
                amount: $amount,
                cashAccountCode: ChartOfAccounts::SUSPENSE,
                idempotencyKey: $idempotencyKey,
                description: '[Admin] ' . $request->input('reason'),
            );
        } else {
            // For a debit, hold then immediately settle (recognise as admin adjustment)
            $holdTx = $this->wallets->holdForPurchase(
                wallet: $wallet,
                amount: $amount,
                idempotencyKey: $idempotencyKey,
                description: '[Admin debit] ' . $request->input('reason'),
            );
            $tx = $this->wallets->settleSuspense($holdTx, $idempotencyKey . '_settle');
        }

        Audit::log('admin.wallet_adjusted', $user, [
            'direction'    => $request->input('direction'),
            'amount_minor' => $amount->amountMinor,
            'currency'     => $amount->currency,
            'reason'       => $request->input('reason'),
            'admin_id'     => $admin->id,
        ], actorType: 'admin');

        return ApiResponse::ok(
            new TransactionResource($tx),
            'Wallet adjusted successfully.'
        );
    }

    public function userTransactions(Request $request, string $publicId)
    {
        $request->validate(['per_page' => ['nullable', 'integer', 'min:1', 'max:100']]);
        $user = User::where('public_id', $publicId)->firstOrFail();
        $page = Transaction::where('user_id', $user->id)
            ->orderByDesc('id')
            ->paginate((int) ($request->input('per_page') ?? 20));

        return ApiResponse::ok([
            'items' => TransactionResource::collection($page->items()),
            'meta'  => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'total'        => $page->total(),
            ],
        ]);
    }

    // ─── Transactions ─────────────────────────────────────────────────────────

    public function transactions(Request $request)
    {
        $request->validate([
            'per_page'   => ['nullable', 'integer', 'min:1', 'max:200'],
            'status'     => ['nullable', 'string'],
            'type'       => ['nullable', 'string'],
            'user_email' => ['nullable', 'string'],
            'from'       => ['nullable', 'date'],
            'to'         => ['nullable', 'date'],
        ]);

        $q = Transaction::with('user')->orderByDesc('id');

        if ($s = $request->input('status'))     $q->where('status', $s);
        if ($t = $request->input('type'))       $q->where('type', $t);
        if ($f = $request->input('from'))       $q->where('created_at', '>=', $f);
        if ($to = $request->input('to'))        $q->where('created_at', '<=', $to . ' 23:59:59');
        if ($e = $request->input('user_email')) {
            $q->whereHas('user', fn ($w) => $w->where('email', 'ilike', "%{$e}%"));
        }

        $page = $q->paginate((int) ($request->input('per_page') ?? 50));

        $items = collect($page->items())->map(fn (Transaction $tx) => array_merge(
            (new TransactionResource($tx))->resolve(),
            ['user_email' => $tx->user?->email, 'user_name' => $tx->user?->name]
        ));

        return ApiResponse::ok([
            'items' => $items,
            'meta'  => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'total'        => $page->total(),
            ],
        ]);
    }

    // ─── Services ─────────────────────────────────────────────────────────────

    public function services()
    {
        $services = Service::orderBy('category')->orderBy('name')->get();

        // Attach order counts to each service
        $items = $services->map(fn (Service $s) => array_merge(
            (new ServiceResource($s))->resolve(),
            [
                'orders_today'   => DB::table('service_orders')
                    ->where('service_id', $s->id)
                    ->where('created_at', '>=', now()->startOfDay())
                    ->count(),
                'orders_total'   => DB::table('service_orders')
                    ->where('service_id', $s->id)
                    ->count(),
                'orders_failed'  => DB::table('service_orders')
                    ->where('service_id', $s->id)
                    ->whereIn('status', ['failed', 'refunded'])
                    ->where('created_at', '>=', now()->subDays(7))
                    ->count(),
                'markup_percent' => $s->markup_percent
                    ?? config('services.platform.markup_percent', 15),
            ]
        ));

        return ApiResponse::ok($items);
    }

    public function toggleService(Request $request, string $code)
    {
        $request->validate(['is_active' => ['required', 'boolean']]);
        $svc = Service::where('code', $code)->firstOrFail();
        $svc->update(['is_active' => (bool) $request->input('is_active')]);
        Audit::log('admin.service_toggled', $svc, ['is_active' => $svc->is_active], actorType: 'admin');
        return ApiResponse::ok(null, $svc->is_active ? 'Service enabled.' : 'Service disabled.');
    }

    public function updateServiceMarkup(Request $request, string $code)
    {
        $request->validate(['markup_percent' => ['required', 'numeric', 'min:0', 'max:500']]);
        $svc = Service::where('code', $code)->firstOrFail();
        $svc->update(['markup_percent' => (float) $request->input('markup_percent')]);
        Audit::log('admin.service_markup_updated', $svc, [
            'markup_percent' => $svc->markup_percent,
        ], actorType: 'admin');
        return ApiResponse::ok(null, 'Markup updated.');
    }

    // ─── Metrics ──────────────────────────────────────────────────────────────

    public function metrics()
    {
        $todayStart = now()->startOfDay();
        return ApiResponse::ok([
            'users_total'                => User::count(),
            'users_active_24h'           => User::where('last_login_at', '>=', $todayStart->copy()->subDay())->count(),
            'transactions_today'         => Transaction::where('created_at', '>=', $todayStart)->count(),
            'transactions_success_24h'   => Transaction::where('status', 'success')->where('created_at', '>=', $todayStart->copy()->subDay())->count(),
            'transactions_failed_24h'    => Transaction::where('status', 'failed')->where('created_at', '>=', $todayStart->copy()->subDay())->count(),
            'payments_pending'           => Payment::whereIn('status', ['initiated', 'pending'])->count(),
            'gmv_today_minor'            => (int) Transaction::where('type', TransactionType::SERVICE_PURCHASE->value)->where('status', TransactionStatus::SUCCESS->value)->where('created_at', '>=', $todayStart)->sum('amount_minor'),
            'wallet_funding_today_minor' => (int) Transaction::where('type', TransactionType::WALLET_FUNDING->value)->where('status', TransactionStatus::SUCCESS->value)->where('created_at', '>=', $todayStart)->sum('amount_minor'),
        ]);
    }
}
