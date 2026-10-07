import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toastBus } from './utils/toastBus';
import { formatApiError } from './utils/formatApiError';

const getStatus = (error) => Number(error?.status || error?.response?.status);

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const status = getStatus(error);
      if (status === 401) return;

      if (query.state.data !== undefined) {
        toastBus.emit('info', 'Could not refresh');
        return;
      }

      toastBus.emit('error', error?.message || 'Failed to load data');
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return;

      if (getStatus(error) === 422 || error?.code === 'VALIDATION_FAILED') {
        toastBus.emit('error', formatApiError(error));
        return;
      }

      toastBus.emit('error', error?.message || 'Request failed');
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: (failureCount, error) => {
        if (failureCount >= 1) return false;
        return ![401, 403, 404, 422].includes(getStatus(error));
      },
      refetchOnWindowFocus: false,
      placeholderData: (previousData) => previousData,
    },
  },
});

queryClient.setQueryDefaults(['masters'], {
  staleTime: 10 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
});

queryClient.setQueryDefaults(['masterItems'], {
  staleTime: 10 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
});

export default queryClient;