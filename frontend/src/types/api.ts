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
  service?: { code: string; name: string; provider: string };
  status: 'pending' | 'provisioning' | 'completed' | 'failed' | 'refunded';
  amount_minor: number;
  amount: string;
  currency: string;
  request: Record<string, unknown> | null;
  delivery: Record<string, unknown> | null;
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
  ip?: string | null;
  port: number;
  username: string;
  password?: string;
  proxy_url?: string;
  proxy_url_ip?: string | null;
  location_country: string;
  location_city: string | null;
  isp: string | null;
  state_code: string | null;
  ip_auth_enabled: boolean;
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

export type ProxyListing = {
  id: string;
  country_code: string;
  country_name: string;
  state_code: string | null;
  state_name: string | null;
  city: string | null;
  isp: string | null;
  zip: string | null;
  ip_display: string | null;
  connection_type: 'wifi' | 'cell';
  protocol: 'http' | 'socks5';
  speed_ms: number;
  price_minor: number;
  price: string;
  is_available: boolean;
};

export type MarketplaceCountries = {
  us_total: number;
  world_total: number;
  us_states: { code: string; name: string; count: number }[];
  world: { code: string; name: string; count: number }[];
};

export type MarketplacePage = {
  items: ProxyListing[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

export type GiftCardProduct = {
  product_id: number;
  name: string;
  brand: string;
  country_code: string;
  currency: string;
  logo_url: string | null;
  denomination_type: 'fixed' | 'range';
  fixed_denominations: number[];
  min_amount: number;
  max_amount: number;
  sender_fee: number;
  sender_fee_pct: number;
  category: string;
};
