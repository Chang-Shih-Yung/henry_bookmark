import type { Holdings, Holding } from './types';

/**
 * 第一次登入時的預設 holdings 範本。
 * 使用者進來會看到所有資產類別的範例,可以編輯 / 刪除。
 *
 * 富邦信託預設 monthlyAutoBuyTwd: 4000(自存 2000 + 公司補 2000)。
 */
function uid(): string {
  return crypto.randomUUID();
}

const now = (): string => new Date().toISOString();

export function defaultHoldings(): Holdings {
  const items: Holding[] = [
    {
      id: uid(),
      type: 'tw_stock',
      symbol: '2330.TW',
      displayName: '台積電',
      units: 0,
      costBasisTwd: 0,
      monthlyAutoBuyTwd: 5000,
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'tw_stock',
      symbol: '0050.TW',
      displayName: '元大台灣 50',
      units: 0,
      costBasisTwd: 0,
      monthlyAutoBuyTwd: 6000,
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'us_stock',
      symbol: 'GOOGL',
      displayName: 'Google',
      units: 0,
      costBasisTwd: 0,
      monthlyAutoBuyTwd: 1600, // ~50 USD * 32 TWD
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'us_stock',
      symbol: 'VTI',
      displayName: 'VTI 全市場',
      units: 0,
      costBasisTwd: 0,
      monthlyAutoBuyTwd: 3200, // ~100 USD * 32 TWD
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'crypto',
      symbol: 'BTC',
      displayName: '比特幣',
      units: 0,
      costBasisTwd: 80_000,
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'crypto',
      symbol: 'ETH',
      displayName: '以太幣',
      units: 0,
      costBasisTwd: 0,
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'crypto',
      symbol: 'ADA',
      displayName: '艾達幣',
      units: 0,
      costBasisTwd: 0,
      updatedAt: now(),
    },
    {
      id: uid(),
      type: 'cash_twd',
      symbol: 'TWD-Bank',
      displayName: '台幣活存',
      units: 0,
      costBasisTwd: 0,
      monthlyAutoBuyTwd: 6700,
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
      monthlyAutoBuyTwd: 4000,
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
