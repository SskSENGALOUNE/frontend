"use client";

import { useCallback, useEffect, useState } from "react";
import { errorText, get } from "./api";

interface Result<T> {
  path: string | null;
  tick: number;
  data: T | null;
  error: string | null;
}

/**
 * Fetches `path` whenever it changes; `reload()` refetches. Pass null to skip.
 *
 * When `path` changes (another month, another filter) `data` is null until the new response
 * arrives, so a page never shows the previous view's numbers as if they were current.
 * `reload()` keeps the current data on screen while it refreshes.
 */
export function useData<T>(path: string | null) {
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<Result<T>>({ path: null, tick: -1, data: null, error: null });

  useEffect(() => {
    if (path === null) return;
    let alive = true;
    get<T>(path).then(
      (data) => alive && setResult({ path, tick, data, error: null }),
      (e) => alive && setResult((r) => ({ path, tick, data: r.path === path ? r.data : null, error: errorText(e) })),
    );
    return () => {
      alive = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const sameView = result.path === path;
  return {
    data: sameView ? result.data : null,
    error: sameView ? result.error : null,
    loading: path !== null && (!sameView || result.tick !== tick),
    reload,
  };
}

/** Returns `value` once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
