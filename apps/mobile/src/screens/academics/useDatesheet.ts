import { useQuery } from '@tanstack/react-query';
import { loadDatesheet } from '../../cuims/datesheetClient';

/** The date sheet, from the portal when the saved session is alive, otherwise from the copy on this phone. */
export function useDatesheet() {
  return useQuery({
    queryKey: ['datesheet'],
    queryFn: loadDatesheet,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
}
