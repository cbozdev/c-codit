export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  email_verified: boolean;
  is_active: boolean;
  is_suspended: boolean;
  roles: string[];
  last_login_at: string | null;
  terms_accepted_at: string | null;
  created_at: string;
};

export type Wallet = {
  id: string;
  currency: string;
  balance_minor: number;
  balance: string;
  is_frozen: boolean;
  frozen_reason: string | null;
  updated_at: string;
};

export type TxStatus = 'pending' | 'processing' | 'success' | 'failed' | 'refunded' | 'reversed';
export type TxType = 'wallet_funding' | 'service_purchase' | 'refund' | 'adjustment' | 'reversal';

export type Transaction = {
  id: string;
  reference: string;
  type: TxType;
  status: TxStatus;
  amount_minor: number;
  amount: string;
  currency: string;
  description: string | null;
  failure_reason: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
};

export type Service = {
  code: string;
  name: string;
  category: string;
  provider: string;
  description: string | null;
  is_active: boolean;
  currency: string;
};

export type ServiceOrder = {
  id: string;
  service?: { code: string; name: string };
  status: 'pending' | 'provisioning' | 'completed' | 'failed' | 'refunded';
  amount_minor: number;
  amount: string;
  currency: string;
  request: Record<string, unknown> | null;
  delivery: { phone_number?: string | null; expires_at?: string | null } | null;
  failure_reason: string | null;
  provisioned_at: string | null;
  refunded_at: string | null;
  created_at: string;
};

export type Paginated<T> = {
  items: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

export type FundingResponse = {
  payment_id: string;
  provider: string;
  checkout_url: string;
  reference: string;
  amount: string;
  currency: string;
  expires_at: string | null;
};

export type ProxySubscription = {
  id: string;
  provider: string;
  proxy_type: string;
  type_label: string;
  protocol: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  proxy_url?: string;
  location_country: string;
  location_city: string | null;
  bandwidth_gb_total: number;
  bandwidth_gb_used: number;
  bandwidth_percent: number;
  ip_count: number;
  threads: number;
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  auto_renew: boolean;
  is_trial: boolean;
  duration_days: number;
  expires_at: string;
  provisioned_at: string;
  last_synced_at: string | null;
  created_at: string;
};

export type ProxyTrialStatus = {
  claimed: boolean;
  expires_at: string | null;
  eligible: boolean;
};

export type ProxyApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  ip_whitelist: string[];
  last_used_at: string | null;
  created_at: string;
};
