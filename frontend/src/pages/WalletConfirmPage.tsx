import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiCall } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { Wallet } from '@/types/api';
import { CheckCircle2, Loader2 } from 'lucide-react';

export default function WalletConfirmPage() {
  const qc = useQueryClient();
  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiCall<Wallet>({ url: '/wallet' }),
    refetchInterval: 5_000,
  });

  // Refresh balance when arriving here
  useEffect(() => { qc.invalidateQueries({ queryKey: ['wallet'] }); }, [qc]);

  return (
    <div className="max-w-lg mx-auto card-pad text-center mt-12">
      <div className="flex justify-center">
        {wallet.isFetching ? (
          <Loader2 className="h-12 w-12 text-brand-600 animate-spin" />
        ) : (
          <CheckCircle2 className="h-12 w-12 text-brand-600" />
        )}
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Almost done</h1>
      <p className="text-ink-600 mt-2 text-sm">
        We're confirming your payment with the provider. Your wallet updates automatically once it's verified.
      </p>
      <div className="mt-6 text-sm text-ink-500">Current balance</div>
      <div className="text-3xl font-semibold tracking-tight mt-1">
        {formatMoney(wallet.data?.balance_minor ?? 0, wallet.data?.currency ?? 'USD')}
      </div>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/wallet"        className="btn-outline">Back to wallet</Link>
        <Link to="/transactions"  className="btn-primary">View transactions</Link>
      </div>
    </div>
  );
}
