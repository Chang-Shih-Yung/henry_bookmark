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
 *   const trigger = useMonthlyTrigger(); // Phase 2: 月扣是否觸發了
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IslandState, MonthlyTriggerResult } from './island-types';

const ISLAND_QUERY_KEY = ['island', 'state'] as const;

/** Phase 2:server 回的 GET payload 含 monthly trigger 結果 */
export type IslandStatePayload = {
  state: IslandState;
  monthlyTrigger: MonthlyTriggerResult | null;
};

async function fetchIslandState(): Promise<IslandStatePayload> {
  const r = await fetch('/api/island/state', { method: 'GET' });
  if (!r.ok) throw new Error(`island state fetch failed: ${r.status}`);
  const json = await r.json();
  return {
    state: json.state as IslandState,
    monthlyTrigger: (json.monthlyTrigger ?? null) as MonthlyTriggerResult | null,
  };
}

export function useIslandState() {
  return useQuery({
    queryKey: ISLAND_QUERY_KEY,
    queryFn: fetchIslandState,
    staleTime: 60_000,            // 1 分鐘內不重打
    gcTime: 24 * 60 * 60 * 1000,  // 24 小時 cache
  });
}

/** Phase 2:取本次 GET 的 monthly trigger(只在剛切月份的那次 GET 不為 null)*/
export function useMonthlyTrigger(): MonthlyTriggerResult | null {
  return useIslandState().data?.monthlyTrigger ?? null;
}

/* ============================================================
   Slice hooks — 從 cache 讀,共用 useIslandState 的 query
   ============================================================ */
export function useMascot() {
  return useIslandState().data?.state.profile.mascot;
}

export function usePikminTribeName() {
  return useIslandState().data?.state.profile.pikminTribeName;
}

export function useTracks() {
  return useIslandState().data?.state.tracks;
}

export function useGoals() {
  return useIslandState().data?.state.goals ?? [];
}

export function usePikminCollection() {
  return useIslandState().data?.state.collections.pikmin ?? [];
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
      return json.state as IslandState;
    },
    onSuccess: (newState) => {
      // 寫回 cache 時保留現有 monthlyTrigger(POST 不重新 trigger)
      queryClient.setQueryData<IslandStatePayload>(
        ISLAND_QUERY_KEY,
        (prev) => ({
          state: newState,
          monthlyTrigger: prev?.monthlyTrigger ?? null,
        }),
      );
    },
  });
}
