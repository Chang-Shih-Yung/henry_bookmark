import type { Holding } from './types';
import { formatPrice } from './format';

/**
 * Holding 相關純函式 helper — 從廢棄的 HoldingEditSheet.tsx 抽出來,
 * 集中放在 lib/ 而不是某個 component 內部 export。
 *
 * 這些函式不依賴 React,任何元件 / API route / test 都能直接 import。
 */

/**
 * 該資產類別的「市場行情」是否以 USD 計價(美股、加密貨幣)。
 *
 * 注意:cash_usd 不算 — 現金沒有「市場行情」概念,price 永遠是 1 USD。
 * cash_usd 的 USD 顯示由各 component 透過 holding.type === 'cash_usd' 自己判斷。
 *
 * BuyDialog 的內部變數 isUsdNative 額外把 cash_usd 算進去(因為要從 app 抄美元餘額),
 * 那是 BuyDialog 特有的「USD 輸入 / 顯示」語意,跟這裡的「市場行情 USD 計價」是兩件事。
 */
export function isUsdNativeType(type: Holding['type']): boolean {
  return type === 'us_stock' || type === 'crypto';
}

/** 顯示在 UI 的單位標籤(股 / 顆 / TWD / USD)。 */
export function unitLabel(type: Holding['type']): string {
  switch (type) {
    case 'tw_stock':
    case 'us_stock':
      return '股';
    case 'crypto':
      return '顆';
    case 'cash_twd':
      return 'TWD';
    case 'cash_usd':
      return 'USD';
    case 'trust':
      return 'TWD';
  }
}

/**
 * 把 TWD 計價的 priceTwd 顯示成適當貨幣字串。
 * USD-native 資產的 priceTwd 已是 server side 換算過的 TWD per share / coin,
 * 顯示時除以 fxRate 還原成 USD,看起來才像「美股 / 加密原始計價」。
 */
export function formatPriceForDisplay(
  priceTwd: number | null,
  isUsdNative: boolean,
  fxRate: number,
): string {
  if (priceTwd === null) return '—';
  if (isUsdNative && fxRate > 0) {
    return formatPrice(priceTwd / fxRate, 'USD');
  }
  return formatPrice(priceTwd, 'TWD');
}
