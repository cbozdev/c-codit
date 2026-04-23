import { useQuery } from '@tanstack/react-query';
import { apiCall } from '@/lib/api';
import type { Service } from '@/types/api';

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: () => apiCall<Service[]>({ method: 'GET', url: '/services' }),
    staleTime: 5 * 60_000,
  });
}
