import { useQuery } from '@tanstack/react-query';
import { loadIdCard } from '../../cuims/idCardClient';

/** The virtual ID card, from the portal when the saved session is alive, otherwise from the copy on this phone. */
export function useIdCard() {
  return useQuery({
    queryKey: ['idcard'],
    queryFn: loadIdCard,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
}
