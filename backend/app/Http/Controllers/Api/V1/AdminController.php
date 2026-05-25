<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Http\Controllers\Controller;
use App\Http\Resources\ServiceResource;
use App\Http\Resources\TransactionResource;
use App\Http\Resources\UserResource;
use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\ServiceConfig;
use App\Models\Payment;
use App\Models\Service;
use App\Models\ServiceOrder;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Ledger\ChartOfAccounts;
use App\Services\Wallet\WalletService;
use App\Support\ApiResponse;
use App\Support\Audit;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

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
                $w->where('email', 'like', "%{$s}%")
                  ->orWhere('name',  'like', "%{$s}%")
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

        // Alert if adjustment > $100
        if ($amount->amountMinor >= 10000) {
            try {
                $adminEmail = config('mail.from.address', 'no-reply@c-codit.com');
                $dir = strtoupper((string) $request->input('direction'));
                Mail::raw(
                    "Admin wallet adjustment alert:\n\nAdmin: {$admin->name} ({$admin->email})\nUser: {$user->name} ({$user->email})\nDirection: {$dir}\nAmount: {$amount->currency} {$amount->amountMinor}\nReason: {$request->input('reason')}\nTime: " . now()->toDateTimeString(),
                    fn ($m) => $m->to($adminEmail)->subject("[C-codit Alert] Large wallet {$dir} — {$amount->currency} " . number_format($amount->amountMinor / 100, 2))
                );
            } catch (\Throwable) {}
        }

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
            $q->whereHas('user', fn ($w) => $w->where('email', 'like', "%{$e}%"));
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

    // ─── Profit ───────────────────────────────────────────────────────────────

    public function profit(Request $request)
    {
        $period = $request->input('period', '30d');
        $from   = match ($period) {
            'today' => now()->startOfDay(),
            '7d'    => now()->subDays(7)->startOfDay(),
            'all'   => null,
            default => now()->subDays(30)->startOfDay(),
        };

        $base = DB::table('service_orders')->where('status', 'completed');
        if ($from) $base->where('created_at', '>=', $from);

        $summary = (clone $base)->selectRaw('
            COUNT(*) as orders,
            COALESCE(SUM(amount_minor), 0) as revenue_minor,
            COALESCE(SUM(cost_minor), 0) as cost_minor,
            COALESCE(SUM(CASE WHEN cost_minor IS NOT NULL THEN amount_minor - cost_minor ELSE 0 END), 0) as profit_minor
        ')->first();

        $byService = DB::table('service_orders')
            ->join('services', 'service_orders.service_id', '=', 'services.id')
            ->where('service_orders.status', 'completed')
            ->when($from, fn ($q) => $q->where('service_orders.created_at', '>=', $from))
            ->selectRaw('
                services.name,
                services.category,
                services.markup_percent,
                COUNT(*) as orders,
                COALESCE(SUM(service_orders.amount_minor), 0) as revenue_minor,
                COALESCE(SUM(service_orders.cost_minor), 0) as cost_minor,
                COALESCE(SUM(CASE WHEN service_orders.cost_minor IS NOT NULL THEN service_orders.amount_minor - service_orders.cost_minor ELSE 0 END), 0) as profit_minor
            ')
            ->groupBy('services.id', 'services.name', 'services.category', 'services.markup_percent')
            ->orderByDesc('revenue_minor')
            ->get()
            ->map(fn ($row) => [
                'name'           => $row->name,
                'category'       => $row->category,
                'markup_percent' => $row->markup_percent,
                'orders'         => (int) $row->orders,
                'revenue_minor'  => (int) $row->revenue_minor,
                'cost_minor'     => (int) $row->cost_minor,
                'profit_minor'   => (int) $row->profit_minor,
                'margin_percent' => $row->revenue_minor > 0
                    ? round(($row->profit_minor / $row->revenue_minor) * 100, 1)
                    : 0,
            ]);

        $byDay = DB::table('service_orders')
            ->where('status', 'completed')
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->selectRaw('
                DATE(created_at) as date,
                COUNT(*) as orders,
                COALESCE(SUM(amount_minor), 0) as revenue_minor,
                COALESCE(SUM(CASE WHEN cost_minor IS NOT NULL THEN amount_minor - cost_minor ELSE 0 END), 0) as profit_minor
            ')
            ->groupByRaw('DATE(created_at)')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => [
                'date'          => $row->date,
                'orders'        => (int) $row->orders,
                'revenue_minor' => (int) $row->revenue_minor,
                'profit_minor'  => (int) $row->profit_minor,
            ]);

        return ApiResponse::ok([
            'period'     => $period,
            'summary'    => [
                'orders'         => (int) $summary->orders,
                'revenue_minor'  => (int) $summary->revenue_minor,
                'cost_minor'     => (int) $summary->cost_minor,
                'profit_minor'   => (int) $summary->profit_minor,
                'margin_percent' => $summary->revenue_minor > 0
                    ? round(($summary->profit_minor / $summary->revenue_minor) * 100, 1)
                    : 0,
            ],
            'by_service' => $byService,
            'by_day'     => $byDay,
        ]);
    }

    // ─── Messaging ────────────────────────────────────────────────────────────

    /**
     * Send a message to a user (email + in-app notification).
     */
    public function messageUser(Request $request, string $publicId)
    {
        $request->validate([
            'subject' => ['required', 'string', 'max:150'],
            'body'    => ['required', 'string', 'max:5000'],
            'channel' => ['nullable', 'in:email,in_app,both'],
        ]);

        $user    = User::where('public_id', $publicId)->firstOrFail();
        $channel = $request->input('channel', 'both');
        $admin   = $request->user();

        // Send email via Laravel Mail
        if (in_array($channel, ['email', 'both'])) {
            try {
                \Illuminate\Support\Facades\Mail::send(
                    [],
                    [],
                    function ($mail) use ($user, $request) {
                        $mail->to($user->email, $user->name)
                            ->subject('[C-codit] ' . $request->input('subject'))
                            ->html(
                                '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px">' .
                                '<h2 style="color:#0a2416">C-codit</h2>' .
                                '<p>' . nl2br(htmlspecialchars($request->input('body'))) . '</p>' .
                                '<hr style="border:1px solid #e5e7eb;margin:24px 0">' .
                                '<p style="color:#6b7280;font-size:12px">This message was sent by the C-codit support team. Reply to support@c-codit.com if you have questions.</p>' .
                                '</div>'
                            );
                    }
                );
            } catch (\Throwable $e) {
                return ApiResponse::fail('Email delivery failed: ' . $e->getMessage(), null, 422);
            }
        }

        Audit::log('admin.user_messaged', $user, [
            'subject'  => $request->input('subject'),
            'channel'  => $channel,
            'admin_id' => $admin->id,
        ], actorType: 'admin');

        return ApiResponse::ok(null, 'Message sent to ' . $user->name . '.');
    }

    /**
     * Broadcast a message to all users (or filtered subset).
     */
    public function broadcastMessage(Request $request)
    {
        $request->validate([
            'subject'  => ['required', 'string', 'max:150'],
            'body'     => ['required', 'string', 'max:5000'],
            'audience' => ['nullable', 'in:all,verified,active_30d'],
        ]);

        $audience = $request->input('audience', 'all');
        $query    = User::query();

        if ($audience === 'verified')   $query->whereNotNull('email_verified_at');
        if ($audience === 'active_30d') $query->where('last_login_at', '>=', now()->subDays(30));

        $count = $query->count();

        $failed = 0;
        $lastError = null;

        $query->chunk(100, function ($users) use ($request, &$failed, &$lastError) {
            foreach ($users as $user) {
                try {
                    \Illuminate\Support\Facades\Mail::send([], [], function ($mail) use ($user, $request) {
                        $mail->to($user->email, $user->name)
                            ->subject('[C-codit] ' . $request->input('subject'))
                            ->html(
                                '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px">' .
                                '<h2 style="color:#0a2416">C-codit</h2>' .
                                '<p>' . nl2br(htmlspecialchars($request->input('body'))) . '</p>' .
                                '<hr style="border:1px solid #e5e7eb;margin:24px 0">' .
                                '<p style="color:#6b7280;font-size:12px">You received this because you have a C-codit account. <a href="mailto:support@c-codit.com">Unsubscribe</a></p>' .
                                '</div>'
                            );
                    });
                } catch (\Throwable $e) {
                    $failed++;
                    $lastError = $e->getMessage();
                    \Log::warning('admin.broadcast.mail_failed', ['email' => $user->email, 'error' => $e->getMessage()]);
                }
            }
        });

        if ($failed === $count && $count > 0) {
            return ApiResponse::fail('Email delivery failed: ' . $lastError, null, 422);
        }

        Audit::log('admin.broadcast_sent', $request->user(), [
            'subject'  => $request->input('subject'),
            'audience' => $audience,
            'count'    => $count,
        ], actorType: 'admin');

        $sent = $count - $failed;
        return ApiResponse::ok(
            ['sent_to' => $sent, 'failed' => $failed],
            $failed > 0
                ? "Message sent to {$sent} users. {$failed} failed."
                : "Message queued for {$sent} users."
        );
    }

    // ─── Refund Transaction ───────────────────────────────────────────────────

    public function refundTransaction(Request $request, string $id)
    {
        $tx = Transaction::where('public_id', $id)
            ->orWhere('reference', $id)
            ->firstOrFail();

        if (! in_array($tx->status, [TransactionStatus::PROCESSING, TransactionStatus::FAILED], true)) {
            return ApiResponse::fail('Only processing or failed transactions can be refunded.', null, 422);
        }

        if ($tx->type !== TransactionType::SERVICE_PURCHASE) {
            return ApiResponse::fail('Only service purchase transactions can be refunded this way.', null, 422);
        }

        DB::transaction(function () use ($tx, $request) {
            $reason = 'Admin refund' . ($request->input('reason') ? ': ' . mb_substr($request->input('reason'), 0, 150) : '');

            $this->wallets->refundSuspense($tx, 'adminrefund:'.$tx->public_id, $reason);

            // Mark related service order as refunded if one exists
            ServiceOrder::where('transaction_id', $tx->id)
                ->whereIn('status', ['provisioning', 'pending', 'failed'])
                ->update([
                    'status'         => 'refunded',
                    'failure_reason' => $reason,
                    'refunded_at'    => now(),
                ]);
        });

        Audit::log('admin.transaction_refunded', $request->user(), ['transaction' => $tx->reference], actorType: 'admin');

        return ApiResponse::ok(null, 'Transaction refunded successfully.');
    }

    // ─── App Settings ─────────────────────────────────────────────────────────

    public function getSettings()
    {
        return ApiResponse::ok(AppSetting::publicSettings());
    }

    public function updateSettings(Request $request)
    {
        $request->validate([
            'logo_url'      => ['nullable', 'string', 'max:700000'], // supports base64-encoded images up to ~500 KB
            'favicon_url'   => ['nullable', 'string', 'max:700000'],
            'app_name'      => ['nullable', 'string', 'max:80'],
            'support_email' => ['nullable', 'email', 'max:255'],
        ]);

        foreach (['logo_url', 'favicon_url', 'app_name', 'support_email'] as $key) {
            if ($request->has($key)) {
                AppSetting::setValue($key, $request->input($key));
            }
        }

        Audit::log('admin.settings_updated', $request->user(), $request->only(['logo_url', 'favicon_url', 'app_name', 'support_email']), actorType: 'admin');

        return ApiResponse::ok(AppSetting::publicSettings(), 'Settings saved.');
    }

    // ─── API Key Management ───────────────────────────────────────────────────

    private static array $KEY_SCHEMA = [
        ['group' => 'fivesim',      'key' => 'api_key',          'label' => '5sim API Key',                    'is_secret' => true],
        ['group' => 'smsactivate',  'key' => 'api_key',          'label' => 'SMS Activate API Key',            'is_secret' => true],
        ['group' => 'smsman',       'key' => 'api_key',          'label' => 'SMS Man API Key',                 'is_secret' => true],
        ['group' => 'smspool',      'key' => 'api_key',          'label' => 'SMSPool API Key',                 'is_secret' => true],
        ['group' => 'pvadeals',     'key' => 'api_key',          'label' => 'PVADeals API Key',                'is_secret' => true],
        ['group' => 'flutterwave',  'key' => 'public_key',       'label' => 'Flutterwave Public Key',          'is_secret' => false],
        ['group' => 'flutterwave',  'key' => 'secret_key',       'label' => 'Flutterwave Secret Key',          'is_secret' => true],
        ['group' => 'flutterwave',  'key' => 'encryption_key',   'label' => 'Flutterwave Encryption Key',      'is_secret' => true],
        ['group' => 'flutterwave',  'key' => 'webhook_secret',   'label' => 'Flutterwave Webhook Secret',      'is_secret' => true],
        ['group' => 'nowpayments',  'key' => 'api_key',          'label' => 'NOWPayments API Key',             'is_secret' => true],
        ['group' => 'nowpayments',  'key' => 'ipn_secret',       'label' => 'NOWPayments IPN Secret',          'is_secret' => true],
        ['group' => 'reloadly',     'key' => 'client_id',        'label' => 'Reloadly Client ID',              'is_secret' => false],
        ['group' => 'reloadly',     'key' => 'client_secret',    'label' => 'Reloadly Client Secret',          'is_secret' => true],
        ['group' => 'decodo',        'key' => 'username',         'label' => 'Decodo Username',                 'is_secret' => false],
        ['group' => 'decodo',        'key' => 'password',         'label' => 'Decodo Password',                 'is_secret' => true],
        ['group' => 'textverified',  'key' => 'api_key',          'label' => 'TextVerified API Key',            'is_secret' => true],
        ['group' => 'textverified',  'key' => 'webhook_secret',   'label' => 'TextVerified Webhook Secret',     'is_secret' => true],
        ['group' => 'textverified',  'key' => 'proxy_url',        'label' => 'TextVerified Proxy URL (CF Worker)', 'is_secret' => false],
        ['group' => 'textverified',  'key' => 'proxy_secret',     'label' => 'TextVerified Proxy Secret',       'is_secret' => true],
    ];

    public function getApiKeys()
    {
        $rows = ServiceConfig::all()->keyBy(fn ($r) => $r->group . '.' . $r->key);

        $result = collect(self::$KEY_SCHEMA)->map(function (array $def) use ($rows) {
            $row = $rows->get($def['group'] . '.' . $def['key']);
            $hasValue = $row && $row->getDecryptedValue() !== null;
            $preview  = null;

            if ($hasValue && ! $def['is_secret']) {
                $preview = $row->getDecryptedValue();
            } elseif ($hasValue) {
                $val     = $row->getDecryptedValue() ?? '';
                $preview = strlen($val) > 4 ? '••••' . substr($val, -4) : '••••';
            }

            return [
                'group'      => $def['group'],
                'key'        => $def['key'],
                'label'      => $def['label'],
                'is_secret'  => $def['is_secret'],
                'has_value'  => $hasValue,
                'preview'    => $preview,
                'updated_at' => $row?->updated_at?->toDateTimeString(),
            ];
        });

        return ApiResponse::ok($result->values()->toArray());
    }

    public function updateApiKey(Request $request)
    {
        $request->validate([
            'group' => ['required', 'string', 'max:60'],
            'key'   => ['required', 'string', 'max:80'],
            'value' => ['required', 'string', 'max:2000'],
        ]);

        $group = $request->input('group');
        $key   = $request->input('key');

        // Only allow defined keys
        $allowed = collect(self::$KEY_SCHEMA)->first(
            fn ($d) => $d['group'] === $group && $d['key'] === $key
        );

        if (! $allowed) {
            return ApiResponse::fail('Unknown config key.', null, 422);
        }

        $row = ServiceConfig::firstOrNew(['group' => $group, 'key' => $key]);
        $row->is_secret  = $allowed['is_secret'];
        $row->label      = $allowed['label'];
        $row->updated_by = $request->user()->id;
        $row->value      = $request->input('value'); // mutator handles encryption
        $row->save();

        // Clear config cache so new value is picked up on next request
        try { Artisan::call('config:clear'); } catch (\Throwable) {}

        // Clear provider-specific caches so new credentials take effect immediately
        Cache::forget("{$group}.bearer_token");
        Cache::forget("{$group}.services");
        Cache::forget("{$group}.targets");
        Cache::forget("{$group}.catalog");

        Audit::log('admin.api_key_updated', $request->user(), ['group' => $group, 'key' => $key], actorType: 'admin');

        return ApiResponse::ok(null, 'Key saved.');
    }

    public function deleteApiKey(Request $request)
    {
        $request->validate([
            'group' => ['required', 'string', 'max:60'],
            'key'   => ['required', 'string', 'max:80'],
        ]);

        ServiceConfig::where('group', $request->input('group'))
            ->where('key', $request->input('key'))
            ->delete();

        Audit::log('admin.api_key_deleted', $request->user(), [
            'group' => $request->input('group'),
            'key'   => $request->input('key'),
        ], actorType: 'admin');

        return ApiResponse::ok(null, 'Key removed.');
    }

    // ─── Audit Log Viewer ─────────────────────────────────────────────────────

    public function auditLogs(Request $request)
    {
        $query = AuditLog::query()
            ->leftJoin('users', 'audit_logs.user_id', '=', 'users.id')
            ->select('audit_logs.*', 'users.name as user_name', 'users.email as user_email')
            ->orderByDesc('audit_logs.created_at');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('audit_logs.action', 'like', '%' . $search . '%')
                  ->orWhere('users.email', 'like', '%' . $search . '%');
            });
        }

        if ($action = $request->input('action')) {
            $query->where('audit_logs.action', 'like', $action . '%');
        }

        $rows = $query->paginate(50);

        return ApiResponse::ok([
            'items' => $rows->map(fn ($r) => [
                'id'           => $r->id,
                'action'       => $r->action,
                'user_name'    => $r->user_name,
                'user_email'   => $r->user_email,
                'actor_type'   => $r->actor_type,
                'ip_address'   => $r->ip_address,
                'context'      => is_string($r->context) ? json_decode($r->context, true) : $r->context,
                'created_at'   => $r->created_at,
            ]),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page'    => $rows->lastPage(),
                'total'        => $rows->total(),
            ],
        ]);
    }

    // ─── Service Health ───────────────────────────────────────────────────────

    public function serviceHealth()
    {
        $checkedAt = now()->toISOString();
        $results   = [];

        $check = function (string $name, callable $fn) use ($checkedAt, &$results): void {
            $start = microtime(true);
            try {
                $ok  = $fn();
                $ms  = (int) round((microtime(true) - $start) * 1000);
                $results[] = [
                    'provider'    => $name,
                    'status'      => $ok ? 'up' : 'down',
                    'response_ms' => $ok ? $ms : null,
                    'checked_at'  => $checkedAt,
                ];
            } catch (\Throwable) {
                $results[] = ['provider' => $name, 'status' => 'down', 'response_ms' => null, 'checked_at' => $checkedAt];
            }
        };

        $check('5sim', function () {
            $r = Http::withHeaders(['Authorization' => 'Bearer ' . config('services.fivesim.api_key')])->timeout(8)->get('https://5sim.net/v1/guest/prices?country=usa&product=google');
            return $r->successful();
        });

        $check('flutterwave', function () {
            $r = Http::withToken(config('services.flutterwave.secret_key'))->timeout(8)->get(config('services.flutterwave.base_url', 'https://api.flutterwave.com/v3') . '/banks/NG');
            return $r->successful();
        });

        $check('nowpayments', function () {
            $r = Http::withHeaders(['x-api-key' => config('services.nowpayments.api_key')])->timeout(8)->get(config('services.nowpayments.base_url', 'https://api.nowpayments.io/v1') . '/status');
            return $r->successful();
        });

        $check('pvadeals', function () {
            $r = Http::withHeaders(['Authorization' => 'Bearer ' . config('services.pvadeals.api_key'), 'Accept' => 'application/json'])
                ->timeout(8)->get('https://prod-v3.pvadeals.com/v3/api/balance');
            return $r->successful() && ! empty($r->json('success'));
        });

        $check('reloadly', function () {
            $r = Http::timeout(8)->post('https://auth.reloadly.com/oauth/token', [
                'client_id'     => config('services.reloadly.client_id'),
                'client_secret' => config('services.reloadly.client_secret'),
                'grant_type'    => 'client_credentials',
                'audience'      => 'https://giftcards.reloadly.com',
            ]);
            return $r->successful();
        });

        // Alert admin if any provider is down
        $downProviders = collect($results)->where('status', 'down')->pluck('provider')->values()->toArray();
        if (count($downProviders) > 0) {
            $cacheKey = 'health_alert_sent:' . implode(',', $downProviders);
            if (! \Illuminate\Support\Facades\Cache::has($cacheKey)) {
                \Illuminate\Support\Facades\Cache::put($cacheKey, true, now()->addMinutes(60));
                try {
                    $adminEmail = config('mail.from.address', 'no-reply@c-codit.com');
                    Mail::raw(
                        'PROVIDER DOWN: ' . implode(', ', $downProviders) . "\n\nChecked at: " . now()->toDateTimeString(),
                        fn ($m) => $m->to($adminEmail)->subject('[C-codit Alert] Provider(s) down: ' . implode(', ', $downProviders))
                    );
                } catch (\Throwable) {}
            }
        }

        return ApiResponse::ok($results);
    }

    // ─── Referral Stats ───────────────────────────────────────────────────────

    public function referralStats(Request $request)
    {
        $topReferrers = User::withCount(['referrals as total_referrals'])
            ->having('total_referrals', '>', 0)
            ->orderByDesc('total_referrals')
            ->limit(20)
            ->get(['id', 'name', 'email', 'referral_code'])
            ->map(fn ($u) => [
                'name'           => $u->name,
                'email'          => $u->email,
                'referral_code'  => $u->referral_code,
                'total_referrals'=> $u->total_referrals,
            ]);

        $totalReferrals = User::whereNotNull('referred_by')->count();

        return ApiResponse::ok([
            'total_referrals' => $totalReferrals,
            'top_referrers'   => $topReferrers,
        ]);
    }
}
