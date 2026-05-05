/**
 * Tiny React hooks around the API client.
 *
 * We don't pull in @tanstack/react-query for these — there are exactly two
 * read endpoints and they're refetched on tab switch, not on every keystroke.
 * A 30-line `useEffect` is cheaper to ship and easier to reason about.
 */

import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "./client";
import type { ApiLeaderboardResponse, ApiMeResponse } from "./types";

type FetchState<T> = {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
};

function useEndpoint<T>(fetcher: () => Promise<T>, deps: ReadonlyArray<unknown>): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);

  // Avoid setState after unmount (rapid tab switches in dev mode).
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetcher()
      .then((v) => {
        if (!alive.current) return;
        setData(v);
      })
      .catch((err: unknown) => {
        if (!alive.current) return;
        setError(
          err instanceof ApiError ? err : new ApiError(String(err), 0, null),
        );
      })
      .finally(() => {
        if (!alive.current) return;
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, error, refetch: () => setTick((n) => n + 1) };
}

export function useMe(): FetchState<ApiMeResponse> {
  return useEndpoint(() => api.me(), []);
}

export function useLeaderboard(limit = 50): FetchState<ApiLeaderboardResponse> {
  return useEndpoint(() => api.leaderboard(limit), [limit]);
}
