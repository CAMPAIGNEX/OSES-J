"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api-client";

export interface QueryState<T> {
  data: T | undefined;
  error: ApiError | Error | null;
  loading: boolean;
  /** true while a background refresh runs after the first load */
  refreshing: boolean;
  refetch: () => Promise<void>;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

export interface QueryOptions {
  /** Poll interval in ms (0 = off). Polling pauses while the tab is hidden. */
  refreshInterval?: number;
  enabled?: boolean;
  /** Called after each successful fetch (useful to stop polling when a job finishes). */
  onData?: (data: unknown) => void;
}

/** Minimal data hook: fetches a JSON endpoint, supports polling, manual refetch and optimistic updates. */
export function useQuery<T>(path: string | null, options: QueryOptions = {}): QueryState<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [refreshing, setRefreshing] = useState(false);
  const pathRef = useRef(path);
  const hasData = useRef(false);
  const enabled = options.enabled ?? true;
  const onData = options.onData;

  const run = useCallback(async () => {
    if (!path || !enabled) return;
    if (hasData.current) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await api<T>(path);
      if (pathRef.current !== path) return;
      setDataState(result);
      hasData.current = true;
      setError(null);
      onData?.(result);
    } catch (err) {
      if (pathRef.current !== path) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (pathRef.current === path) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [path, enabled, onData]);

  useEffect(() => {
    pathRef.current = path;
    hasData.current = false;
    setDataState(undefined);
    setError(null);
    if (path && enabled) {
      setLoading(true);
      void run();
    } else {
      setLoading(false);
    }
  }, [path, enabled, run]);

  useEffect(() => {
    if (!options.refreshInterval || !path || !enabled) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void run();
    }, options.refreshInterval);
    return () => clearInterval(id);
  }, [options.refreshInterval, path, enabled, run]);

  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) => (typeof updater === "function" ? (updater as (p: T | undefined) => T)(prev) : updater));
  }, []);

  return { data, error, loading, refreshing, refetch: run, setData };
}
