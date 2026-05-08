'use client';

/**
 * 遊戲層 client-side hook(GDD §32.7 共用 cache pattern)。
 *
 * 設計原則:**單一 useQuery 讀整個 mega-object,所有子 slice hook 共用 cache。**
 * 不要每個 slice 都做獨立 useQuery → 會打多次 server。
 *
 * 用法:
 *   const { data, isLoading } = useIslandState();
 *   const mascot = useMascot();      // 從 cache 讀,不再打 server
 *   const tracks = useTracks();
 *   const [patch] = useIslandMutation();
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IslandState } from './island-types';

const ISLAND_QUERY_KEY = ['island', 'state'] as const;

async function fetchIslandState(): Promise<IslandState> {
  const r = await fetch('/api/island/state', { method: 'GET' });
  if (!r.ok) throw new Error(`island state fetch failed: ${r.status}`);
  const json = await r.json();
  // server 回 { ok: true, state: IslandState } 或舊格式 IslandState 直接
  return (json.state as IslandState) ?? (json as IslandState);
}

export function useIslandState() {
  return useQuery({
    queryKey: ISLAND_QUERY_KEY,
    queryFn: fetchIslandState,
    staleTime: 60_000,            // 1 分鐘內不重打
    gcTime: 24 * 60 * 60 * 1000,  // 24 小時 cache
  });
}

/* ============================================================
   Slice hooks — 從 cache 讀,共用 useIslandState 的 query
   ============================================================ */
export function useMascot() {
  return useIslandState().data?.profile.mascot;
}

export function usePikminTribeName() {
  return useIslandState().data?.profile.pikminTribeName;
}

export function useTracks() {
  return useIslandState().data?.tracks;
}

export function useGoals() {
  return useIslandState().data?.goals ?? [];
}

export function usePikminCollection() {
  return useIslandState().data?.collections.pikmin ?? [];
}

/* ============================================================
   Mutation — 用 deep-patch 寫回整個 mega-object
   ============================================================ */
type IslandPatch = Partial<IslandState>;

export function useIslandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: IslandPatch) => {
      const r = await fetch('/api/island/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.reason ?? `island patch failed: ${r.status}`);
      }
      const json = await r.json();
      return (json.state as IslandState) ?? (json as IslandState);
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(ISLAND_QUERY_KEY, newState);
    },
  });
}
