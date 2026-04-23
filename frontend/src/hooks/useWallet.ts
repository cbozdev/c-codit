import { useQuery } from '@tanstack/react-query';
import { apiCall } from '@/lib/api';
import type { Wallet } from '@/types/api';

export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiCall<Wallet>({ method: 'GET', url: '/wallet' }),
    refetchInterval: 30_000,
  });
}
