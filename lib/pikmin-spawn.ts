/**
 * Pikmin spawn — 投資組合 → 小精靈顏色映射(GDD §15)。
 *
 * 規則:
 * - 預設 green(台股,Henry persona 假設台股是基礎倉位)
 * - 如果有 holdings,選占比最大的類別對應顏色
 * - 占比超過 30% 該類別小精靈會比較常出現(Phase 5+ 機率系統,本檔只做第一隻)
 *
 * Phase 2 用 costBasisTwd 算占比(不查 prices 即時市價),deterministic 不依賴外部 API。
 * Phase 5+ 可改為讀 useHoldings + usePrices 算 marketValueTwd。
 */

import type { Holdings } from './types';
import type { PikminColor, Pikmin, PikminSpawnContext } from './island-types';

const TYPE_TO_COLOR: Record<string, PikminColor> = {
  tw_stock: 'green',    // 綠 — 台股
  us_stock: 'violet',   // 紫 — 美股
  crypto: 'orange',     // 橙 — 加密
  cash_twd: 'cyan',     // cyan — 現金
  cash_usd: 'cyan',     // cyan — 美金現金合併
  trust: 'grey',        // 灰 — 信託
};

/**
 * 從 holdings 抽出占比 context,給 selectPikminColor / 未來 Phase 5+ 機率系統共用。
 */
export function buildSpawnContext(holdings: Holdings | null): PikminSpawnContext {
  const byType: PikminSpawnContext['byType'] = {};
  if (!holdings || !holdings.items || holdings.items.length === 0) return { byType };

  for (const h of holdings.items) {
    if (!h.type || !Number.isFinite(h.costBasisTwd) || h.costBasisTwd <= 0) continue;
    byType[h.type] = (byType[h.type] ?? 0) + h.costBasisTwd;
  }
  return { byType };
}

/**
 * 第一隻小精靈顏色:選占比最大的類別。
 *
 * 邊界處理:
 * - 沒 holdings → green(預設台股調性)
 * - 空 holdings array → green
 * - 全部 cost = 0 → green
 * - 平手 → 按 TYPE_TO_COLOR key 順序選第一個達到 max 的
 */
export function selectPikminColor(holdings: Holdings | null): PikminColor {
  const ctx = buildSpawnContext(holdings);
  const entries = Object.entries(ctx.byType);

  if (entries.length === 0) return 'green';

  // 找最大占比的 type(平手取 TYPE_TO_COLOR key 順序的第一個)
  const ORDER: Array<keyof typeof TYPE_TO_COLOR> = [
    'tw_stock',
    'us_stock',
    'crypto',
    'cash_twd',
    'cash_usd',
    'trust',
  ];

  let maxType: string | null = null;
  let maxValue = 0;
  for (const type of ORDER) {
    const v = ctx.byType[type as keyof typeof ctx.byType] ?? 0;
    if (v > maxValue) {
      maxValue = v;
      maxType = type;
    }
  }

  if (!maxType || maxValue === 0) return 'green';
  return TYPE_TO_COLOR[maxType] ?? 'green';
}

/**
 * 第一隻小精靈完整物件(stage 從 'sprout' 開始,不是 'egg' — egg 是孵化前狀態)。
 */
export function spawnFirstPikmin(holdings: Holdings | null, nowIso: string): Pikmin {
  const color = selectPikminColor(holdings);
  return {
    id: cryptoRandomId(),
    color,
    stage: 'sprout',
    birthAt: nowIso,
  };
}

/**
 * 跨 runtime 安全的 random id 產生(Edge / Node 都能用)。
 * 不用 lib/utils 因為那邊偏 client style。
 */
function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 退化版本(理論上 Node 18+ / 任何現代 runtime 都不會走到這)
  return `pkmn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
