import type {
  AssetType,
  Config,
  EnrichedHolding,
  Holding,
  PortfolioSummary,
  Prices,
  Scenario,
  SimulationResult,
  SimulationYear,
  Transaction,
  TransactionKind,
} from './types';

/**
 * 從 holding + 即時價算出市值與盈虧。
 *
 * 規則:
 * - tw_stock / us_stock / crypto:price 來自 API,marketValue = units × priceTwd
 * - cash_twd:price 永遠 1,marketValue = units(units 本身就是 TWD 金額)
 * - cash_usd:units 是 USD 金額,marketValue = units × usdTwd 即時匯率
 * - trust:無公開即時價,marketValue = costBasisTwd(等於沒有未實現損益)
 *
 * 如果 API 回 null(該支上游異常),fallback 到 costBasisTwd(避免主畫面爛掉),
 * 並設 hasPriceFallback = true 讓 UI 顯示警告徽章。
 */
export function enrichHolding(
  holding: Holding,
  prices: Prices,
): EnrichedHolding {
  const priceTwd = lookupPriceTwd(holding, prices);
  const prevPriceTwd = lookupPrevPriceTwd(holding, prices);
  const hasPriceFallback = priceTwd === null;

  const marketValueTwd = hasPriceFallback
    ? holding.costBasisTwd
    : holding.units * (priceTwd ?? 0);

  const unrealizedPnlTwd = marketValueTwd - holding.costBasisTwd;
  const unrealizedPnlPct =
    holding.costBasisTwd > 0 ? unrealizedPnlTwd / holding.costBasisTwd : 0;

  // 今日漲跌:用同檔的 current vs prev,純反映該檔價格變化(不含 FX)
  const todayChangeTwd =
    priceTwd !== null && prevPriceTwd !== null
      ? holding.units * (priceTwd - prevPriceTwd)
      : 0;
  const todayChangePct =
    priceTwd !== null && prevPriceTwd !== null && prevPriceTwd > 0
      ? (priceTwd - prevPriceTwd) / prevPriceTwd
      : null;

  return {
    ...holding,
    currentPriceTwd: priceTwd,
    marketValueTwd,
    unrealizedPnlTwd,
    unrealizedPnlPct,
    hasPriceFallback,
    prevPriceTwd,
    todayChangeTwd,
    todayChangePct,
  };
}

/**
 * 從 prices.symbols Record 查當前 TWD 價格。
 * 之前是寫死 switch 對 8 個 symbol 配 8 個 fields,加新 holding 要改三處,
 * 現在改 Record lookup 後加新部位 server / type / calc 都不用動。
 */
function lookupPriceTwd(holding: Holding, prices: Prices): number | null {
  switch (holding.type) {
    case 'tw_stock':
    case 'us_stock':
    case 'crypto':
      return prices.symbols[holding.symbol]?.currentTwd ?? null;
    case 'cash_twd':
      return 1;
    case 'cash_usd':
      // units 是 USD,price = 即時匯率(TWD per USD)
      return prices.usdTwd;
    case 'trust':
      // 無公開即時價,fallback 用 costBasis(回 null 觸發 fallback 路徑)
      return null;
  }
}

/** 對應 lookupPriceTwd 的 prev 版本。現金 / 信託沒「漲跌」概念,直接 null。 */
function lookupPrevPriceTwd(holding: Holding, prices: Prices): number | null {
  switch (holding.type) {
    case 'tw_stock':
    case 'us_stock':
    case 'crypto':
      return prices.symbols[holding.symbol]?.prevTwd ?? null;
    case 'cash_twd':
    case 'cash_usd':
    case 'trust':
      return null;
  }
}

/**
 * 加買:加總 units / costBasis,並 append 一筆交易紀錄。
 * kind 預設 'buy';月扣呼叫時傳 'monthly_dca'。
 */
export function applyBuy(
  holding: Holding,
  addUnits: number,
  addCostTwd: number,
  addCostUsd?: number,
  kind: TransactionKind = 'buy',
  occurredAt?: string,
): Holding {
  if (addUnits < 0 || addCostTwd < 0) {
    throw new Error('applyBuy: addUnits 與 addCostTwd 必須非負');
  }
  const tx = makeTransaction({
    kind,
    unitsDelta: addUnits,
    costDeltaTwd: addCostTwd,
    costDeltaUsd: addCostUsd,
    occurredAt,
  });
  return {
    ...holding,
    units: holding.units + addUnits,
    costBasisTwd: holding.costBasisTwd + addCostTwd,
    ...(addCostUsd != null
      ? { costBasisUsd: (holding.costBasisUsd ?? 0) + addCostUsd }
      : {}),
    transactions: [...(holding.transactions ?? []), tx],
    updatedAt: new Date().toISOString(),
  };
}

/** 建一筆 Transaction;deltas 都用 caller 傳的方向。 */
export function makeTransaction(args: {
  kind: TransactionKind;
  unitsDelta: number;
  costDeltaTwd: number;
  costDeltaUsd?: number;
  pricePerUnitTwd?: number;
  occurredAt?: string;
  notes?: string;
}): Transaction {
  const now = new Date().toISOString();
  const pricePerUnitTwd =
    args.pricePerUnitTwd ??
    (Math.abs(args.unitsDelta) > 0
      ? Math.abs(args.costDeltaTwd) / Math.abs(args.unitsDelta)
      : undefined);
  return {
    id: crypto.randomUUID(),
    kind: args.kind,
    unitsDelta: args.unitsDelta,
    costDeltaTwd: args.costDeltaTwd,
    costDeltaUsd: args.costDeltaUsd,
    pricePerUnitTwd,
    occurredAt: args.occurredAt ?? now,
    recordedAt: now,
    notes: args.notes,
  };
}

/**
 * 賣出:用平均成本扣除 costBasis,差額累積到 realizedPnlTwd,並 append 交易紀錄。
 */
export function applySell(
  holding: Holding,
  sellUnits: number,
  recvTwd: number,
): Holding {
  if (sellUnits < 0 || recvTwd < 0) {
    throw new Error('applySell: sellUnits 與 recvTwd 必須非負');
  }
  if (sellUnits > holding.units + 1e-9) {
    throw new Error(
      `applySell: 賣出數量 ${sellUnits} > 持有 ${holding.units}`,
    );
  }
  const avgCost = holding.units > 0 ? holding.costBasisTwd / holding.units : 0;
  const costRemoved = avgCost * sellUnits;
  const realizedDelta = recvTwd - costRemoved;

  const tx = makeTransaction({
    kind: 'sell',
    unitsDelta: -sellUnits,
    costDeltaTwd: -costRemoved,
    pricePerUnitTwd: sellUnits > 0 ? recvTwd / sellUnits : undefined,
    notes: `已實現 ${realizedDelta >= 0 ? '+' : ''}${Math.round(realizedDelta)} TWD`,
  });

  return {
    ...holding,
    units: holding.units - sellUnits,
    costBasisTwd: holding.costBasisTwd - costRemoved,
    realizedPnlTwd: (holding.realizedPnlTwd ?? 0) + realizedDelta,
    transactions: [...(holding.transactions ?? []), tx],
    updatedAt: new Date().toISOString(),
  };
}

/** 計算整個 portfolio 的彙總(總資產、盈虧、分布、進度)。 */
export function computeSummary(
  enriched: EnrichedHolding[],
  goalTwd: number,
): PortfolioSummary {
  const types: AssetType[] = [
    'tw_stock',
    'us_stock',
    'crypto',
    'cash_twd',
    'cash_usd',
    'trust',
  ];

  const byType: PortfolioSummary['byType'] = Object.fromEntries(
    types.map((t) => [t, { value: 0, pct: 0, count: 0 }]),
  ) as PortfolioSummary['byType'];

  let totalAssetTwd = 0;
  let totalCostBasisTwd = 0;
  let totalTodayChangeTwd = 0;

  for (const h of enriched) {
    totalAssetTwd += h.marketValueTwd;
    totalCostBasisTwd += h.costBasisTwd;
    totalTodayChangeTwd += h.todayChangeTwd;
    byType[h.type].value += h.marketValueTwd;
    byType[h.type].count += 1;
  }

  for (const t of types) {
    byType[t].pct = totalAssetTwd > 0 ? byType[t].value / totalAssetTwd : 0;
  }

  const totalUnrealizedPnlTwd = totalAssetTwd - totalCostBasisTwd;
  const totalUnrealizedPnlPct =
    totalCostBasisTwd > 0 ? totalUnrealizedPnlTwd / totalCostBasisTwd : 0;
  const yesterdayTotal = totalAssetTwd - totalTodayChangeTwd;
  const totalTodayChangePct =
    yesterdayTotal > 0 ? totalTodayChangeTwd / yesterdayTotal : 0;
  const goalProgressPct = goalTwd > 0 ? totalAssetTwd / goalTwd : 0;

  return {
    totalAssetTwd,
    totalCostBasisTwd,
    totalUnrealizedPnlTwd,
    totalUnrealizedPnlPct,
    totalTodayChangeTwd,
    totalTodayChangePct,
    byType,
    goalProgressPct,
  };
}

/**
 * 從當下 holdings 出發跑長期試算。
 *
 * 月複利模型:
 * - 每月起算:把 monthlyAutoBuyTwd 加進對應 holding(模擬定期定額)
 * - 對該 holding 套用月化報酬率(根據 type 對應 returns.{stock|btc|cash})
 * - 每年結束:扣通膨折現算實質購買力
 * - 第 promotionYear 年:salary × (1 + annualRaise + promotionBoost)
 * - 其他年:salary × (1 + annualRaise)
 *
 * 注意:這個函式不更動傳入 holdings,回傳新 array。
 *
 * @see ~/.gstack/projects/nexus_handbook/itts-fubon-design-20260505-085029.md
 */
export function simulate(
  holdings: Holding[],
  config: Config,
  scenario: Scenario,
  years = 10,
): SimulationResult {
  const r = config.returns[scenario];

  // 用「累積市值」逐 holding 跟蹤,起算用 costBasisTwd(因為 simulate 不打 API)
  // UI 端:首頁顯示「現在」用 enrichHolding 算真實市值,試算頁用這個函式
  const tracked: Array<{
    type: AssetType;
    valueTwd: number;
    monthlyAutoBuyTwd: number;
  }> = holdings.map((h) => ({
    type: h.type,
    // 起算用 max(costBasisTwd, units * estimatedPrice) — 但因為 simulate 不打 API
    // 直接用 costBasisTwd(保守起算,避免高估)
    valueTwd: Math.max(h.costBasisTwd, 0),
    monthlyAutoBuyTwd: h.monthlyAutoBuyTwd ?? 0,
  }));

  const result: SimulationResult = [];

  // 月化報酬:(1 + annual)^(1/12) - 1
  const monthlyRate = (annual: number) => Math.pow(1 + annual, 1 / 12) - 1;

  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      for (const t of tracked) {
        const annualRate = pickAnnualReturn(t.type, r);
        const mRate = monthlyRate(annualRate);
        // 月初投入,月底套利
        t.valueTwd = (t.valueTwd + t.monthlyAutoBuyTwd) * (1 + mRate);
      }
    }
    // 年終:加入年終獎金分到現金(簡化:全進 cash_twd)
    const cashTrack = tracked.find((t) => t.type === 'cash_twd');
    if (cashTrack) cashTrack.valueTwd += config.yearlyBonus.amount;

    // 折現
    const inflationFactor = Math.pow(1 + config.inflation, y);

    const byType: Record<AssetType, number> = {
      tw_stock: 0,
      us_stock: 0,
      crypto: 0,
      cash_twd: 0,
      cash_usd: 0,
      trust: 0,
    };
    let total = 0;
    for (const t of tracked) {
      // clamp:任何 type 不可變負(即使 negative return)
      t.valueTwd = Math.max(t.valueTwd, 0);
      byType[t.type] += t.valueTwd;
      total += t.valueTwd;
    }

    const yearStart = new Date(config.meta.startDate).getFullYear();
    const sy: SimulationYear = {
      year: yearStart + y,
      monthlySalary: monthlySalaryAtYear(config, y),
      totalAssetTwd: total,
      totalRealTwd: total / inflationFactor,
      byType,
    };
    result.push(sy);
  }

  return result;
}

function pickAnnualReturn(
  type: AssetType,
  r: { stock: number; btc: number; cash: number },
): number {
  switch (type) {
    case 'tw_stock':
    case 'us_stock':
    case 'trust':
      return r.stock;
    case 'crypto':
      return r.btc;
    case 'cash_twd':
    case 'cash_usd':
      return r.cash;
  }
}

function monthlySalaryAtYear(config: Config, y: number): number {
  let s = config.salary.startMonthly;
  for (let i = 1; i <= y; i++) {
    if (i === config.salary.promotionYear) {
      s *= 1 + config.salary.annualRaise + config.salary.promotionBoost;
    } else {
      s *= 1 + config.salary.annualRaise;
    }
  }
  return s;
}
