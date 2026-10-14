import { useEffect, useState } from "react";

// Runs an async loader and exposes loading/error state plus reload().
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let off = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => !off && setState({ data, loading: false, error: null }))
      .catch((error) => !off && setState({ data: null, loading: false, error }));
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
