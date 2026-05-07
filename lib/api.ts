'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Holdings, PricesResponse } from './types';

/**
 * 把 holdings 轉成 /api/prices 需要的 query string,
 * 例:"tw:2330.TW,tw:0050.TW,us:GOOGL,us:VTI,crypto:BTC,crypto:ETH"
 *
 * cash_* / trust 沒有公開即時價,不用 fetch,所以 skip。
 */
function buildPricesQuery(holdings: Holdings | undefined): string {
  if (!holdings) return '';
  const parts: string[] = [];
  for (const h of holdings.items) {
    if (h.type === 'tw_stock') parts.push(`tw:${h.symbol}`);
    else if (h.type === 'us_stock') parts.push(`us:${h.symbol}`);
    else if (h.type === 'crypto') parts.push(`crypto:${h.symbol}`);
  }
  // dedupe(以防同 symbol 出現多次,例如同一支股票 user 拆成兩筆 holding)
  return [...new Set(parts)].join(',');
}

/**
 * /api/prices 是動態 query 路由 — 依 user 當前 holdings 去 fetch。
 * 沒有 holdings 時不發請求(enabled: false)。
 *
 * staleTime / refetchInterval = 20 秒(跟 server-side cache TTL 一致)。
 */
export function usePrices() {
  const holdingsQ = useHoldings();
  const symbolsQuery = useMemo(
    () => buildPricesQuery(holdingsQ.data),
    [holdingsQ.data],
  );

  return useQuery<PricesResponse>({
    // queryKey 包含 symbolsQuery → user 加 / 刪持股後自動觸發新 fetch
    queryKey: ['prices', symbolsQuery],
    enabled: !!holdingsQ.data && symbolsQuery.length > 0,
    queryFn: async () => {
      const url = `/api/prices?symbols=${encodeURIComponent(symbolsQuery)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`prices ${res.status}`);
      return res.json();
    },
    staleTime: 20_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
}

export function useHoldings() {
  return useQuery<Holdings>({
    queryKey: ['holdings'],
    queryFn: async () => {
      const res = await fetch('/api/holdings');
      if (!res.ok) throw new Error(`holdings ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateHoldings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: Holdings) => {
      const res = await fetch('/api/holdings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`PUT holdings ${res.status}: ${text}`);
      }
      return next;
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ['holdings'] });
      const prev = qc.getQueryData<Holdings>(['holdings']);
      qc.setQueryData(['holdings'], next);
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(['holdings'], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['holdings'] });
    },
  });
}
