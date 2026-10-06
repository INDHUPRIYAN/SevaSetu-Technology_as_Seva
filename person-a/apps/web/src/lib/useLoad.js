// Load data for a screen: const { data, error, loading, reload } = useLoad(() => api.get('/x'), [dep])
import { useCallback, useEffect, useState } from 'react';

export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setState(s => ({ ...s, loading: true }));
    try {
      const data = await run();
      setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      setState(s => ({ ...s, error, loading: false }));
    }
  }, [run]);

  useEffect(() => { reload(); }, [reload]);

  return { ...state, reload, setData: data => setState(s => ({ ...s, data })) };
}
