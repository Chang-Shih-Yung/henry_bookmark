import type { Holdings, Holding } from './types';

/**
 * 第一次登入時的預設 holdings(Henry 的真實基準值,USD/TWD = 31.68)。
 * 之後 user 在 dashboard 直接編,Redis 覆蓋。
 *
 * 來源:
 * - 台股 / 美股:中信銀行 app「申購明細」頁累計扣款 + 月扣金額
 * - 加密:幣安 app「資產 → 加密貨幣」持有量 × 平均買入價
 */
function uid(): string {
  return crypto.randomUUID();
}

const now = (): string => new Date().toISOString();

export function defaultHoldings(): Holdings {
  const items: Holding[] = [
    // ── 台股(TWD)──
    {
      id: uid(),
      type: 'tw_stock',
      symbol: '2330.TW',
      displayName: '台積電',
      units: 15,
      costBasisTwd: 23_751,
      monthlyAutoBuyTwd: 5_000,
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'tw_stock',
      symbol: '0050.TW',
      displayName: '元大台灣 50',
      units: 885,
      costBasisTwd: 62_599,
      monthlyAutoBuyTwd: 6_000,
      updatedAt: now(),
    },
    // ── 美股(USD primary,TWD = USD × 31.68 同步寫入用於 PnL/simulate)──
    {
      id: uid(),
      type: 'us_stock',
      symbol: 'GOOGL',
      displayName: 'Google',
      units: 0.20205,
      costBasisTwd: 1_907,
      costBasisUsd: 60.2,
      monthlyAutoBuyTwd: 1_584,
      monthlyAutoBuyUsd: 50,
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'us_stock',
      symbol: 'VTI',
      displayName: 'VTI 全市場',
      units: 0.45724,
      costBasisTwd: 4_758,
      costBasisUsd: 150.2,
      monthlyAutoBuyTwd: 3_168,
      monthlyAutoBuyUsd: 100,
      updatedAt: now(),
    },
    // ── 加密貨幣(USD primary)──
    {
      id: uid(),
      type: 'crypto',
      symbol: 'BTC',
      displayName: '比特幣',
      units: 0,
      costBasisTwd: 0,
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'crypto',
      symbol: 'ETH',
      displayName: '以太幣',
      units: 0.19435692,
      costBasisTwd: 21_273,
      costBasisUsd: 671.49,
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'crypto',
      symbol: 'ADA',
      displayName: '艾達幣',
      units: 5408.57497361,
      costBasisTwd: 98_624,
      costBasisUsd: 3_113.14,
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'crypto',
      symbol: 'DOGE',
      displayName: '狗狗幣',
      units: 1808.49499497,
      costBasisTwd: 15_354,
      costBasisUsd: 484.68,
      updatedAt: now(),
    },
    // ── 現金 / 信託(目前留空,user 自己填)──
    {
      id: uid(),
      type: 'cash_twd',
      symbol: 'TWD-Bank',
      displayName: '台幣活存',
      units: 0,
      costBasisTwd: 0,
      monthlyAutoBuyTwd: 6_700,
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'cash_usd',
      symbol: 'USD-Cash',
      displayName: '美金現金',
      units: 0,
      costBasisTwd: 0,
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'trust',
      symbol: 'fubon-trust',
      displayName: '富邦信託(自存 2000 + 公司 2000)',
      units: 0,
      costBasisTwd: 0,
      monthlyAutoBuyTwd: 4_000,
      notes: '無公開即時價,以累計買入金額估算市值',
      updatedAt: now(),
    },
  ];

  return {
    schemaVersion: 2,
    items,
    lastModified: now(),
  };
}
