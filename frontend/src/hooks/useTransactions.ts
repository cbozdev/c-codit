import { useQuery } from '@tanstack/react-query';
import { apiCall } from '@/lib/api';
import type { Paginated, Transaction } from '@/types/api';

export function useTransactions(page = 1, perPage = 20) {
  return useQuery({
    queryKey: ['transactions', page, perPage],
    queryFn: () =>
      apiCall<Paginated<Transaction>>({
        method: 'GET',
        url: '/wallet/transactions',
        params: { page, per_page: perPage },
      }),
  });
}
