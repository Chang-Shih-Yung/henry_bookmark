'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Holdings, PricesResponse } from './types';

export function usePrices() {
  return useQuery<PricesResponse>({
    queryKey: ['prices'],
    queryFn: async () => {
      const res = await fetch('/api/prices');
      if (!res.ok) throw new Error(`prices ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
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
