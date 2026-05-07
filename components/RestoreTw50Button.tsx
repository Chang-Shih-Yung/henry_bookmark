'use client';

import { useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHoldings, useUpdateHoldings } from '@/lib/api';
import { toast } from 'sonner';

/**
 * 一次性復原 0050 — Henry 之前誤刪了,我直接幫他重建。
 * 數據是他抄給我的:累計 969 股 / 62,599 TWD / 均價 64.59 / 月扣 6,000
 *
 * Trash bin / soft-delete 是 v2 規劃,有了之後這個按鈕就可以拿掉。
 */
export function RestoreTw50Button() {
  const holdingsQ = useHoldings();
  const updateMut = useUpdateHoldings();
  const [busy, setBusy] = useState(false);

  // 已經有 0050.TW 就隱藏這個按鈕(復原過了)
  const hasTw50 = holdingsQ.data?.items.some(
    (h) => h.symbol === '0050.TW',
  );

  if (!holdingsQ.data || hasTw50) return null;

  const handle = async () => {
    if (!holdingsQ.data) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const tw50 = {
        id: crypto.randomUUID(),
        type: 'tw_stock' as const,
        symbol: '0050.TW',
        displayName: '元大台灣 50',
        units: 969,
        costBasisTwd: 62599,
        monthlyAutoBuyTwd: 6000,
        avgPriceTwd: 64.59,
        updatedAt: now,
        transactions: [
          {
            id: crypto.randomUUID(),
            kind: 'initial' as const,
            unitsDelta: 969,
            costDeltaTwd: 62599,
            occurredAt: now,
            recordedAt: now,
            notes: '系統還原(誤刪復原)',
          },
        ],
      };
      const next = {
        ...holdingsQ.data,
        items: [...holdingsQ.data.items, tw50],
        lastModified: now,
      };
      await updateMut.mutateAsync(next);
      toast.success('0050 已還原', {
        description: '累計 969 股 / NT$ 62,599 / 均價 64.59',
      });
    } catch (e) {
      toast.error('還原失敗', {
        description: e instanceof Error ? e.message : '未知錯誤',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      onClick={handle}
      disabled={busy}
      className="w-full gap-2"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RotateCcw className="h-4 w-4" />
      )}
      還原 0050(誤刪復原)
    </Button>
  );
}
