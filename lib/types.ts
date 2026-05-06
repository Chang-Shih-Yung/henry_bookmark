// Source of truth for all domain types. See design doc V2 SCOPE section.

export type AssetType =
  | 'tw_stock' // 台股
  | 'us_stock' // 美股
  | 'crypto' // 加密貨幣 (BTC / ETH / ADA / DOGE)
  | 'cash_twd' // 台幣現金
  | 'cash_usd' // 美金現金
  | 'trust'; // 富邦信託

export type Scenario = 'conservative' | 'neutral' | 'optimistic';

/**
 * 一個 Holding = 一筆持有資產。
 * User 直接編輯 units 跟 costBasisTwd 兩欄;市值/盈虧由 enrichHolding() 從 live price 算出。
 *
 * - 股票:units = 股數,costBasisTwd = 累計實付台幣成本
 * - 加密貨幣:units = 幣量,costBasisTwd = 累計實付台幣成本
 * - 現金 / 信託:units = TWD 金額,costBasisTwd = units(price 永遠是 1)
 */
export type Holding = {
  id: string; // uuid
  type: AssetType;
  symbol: string; // '2330.TW' / 'GOOGL' / 'BTC' / 'ETH' / 'ADA' / 'DOGE' / 'TWD-Bank' / 'USD-Cash' / 'fubon-trust'
  displayName: string; // 顯示名稱,例:台積電 / Google / 比特幣 / 活存

  units: number;
  /** TWD canonical 成本,PnL 計算永遠用這個。USD-native 編輯時 = USD × 當下 FX。 */
  costBasisTwd: number;
  /**
   * USD 原始輸入(僅 us_stock / crypto / cash_usd)。
   * 設了的話 UI 顯示 USD,沒設 fallback 顯示 TWD。
   * 跟 costBasisTwd 同步寫入,避免重編時失去精度。
   */
  costBasisUsd?: number;
  realizedPnlTwd?: number; // 已實現損益(賣出時累積)

  /**
   * 定期定額(simulate() 用):每月會自動 +N TWD。
   * 例如富邦信託 4000(自存 2000 + 公司補 2000)、定期定額台積 5000。
   */
  monthlyAutoBuyTwd?: number;
  /** USD 原始輸入(僅 us_stock / crypto / cash_usd)。跟 monthlyAutoBuyTwd 同步寫入。 */
  monthlyAutoBuyUsd?: number;

  notes?: string;
  updatedAt: string; // ISO 8601
};

export type Holdings = {
  schemaVersion: 2;
  items: Holding[];
  lastModified: string;
};

export type Config = {
  meta: { startDate: string; title: string };
  salary: {
    startMonthly: number;
    annualRaise: number; // 0.05 = 5% per year
    promotionYear: number; // 第幾年升職(從 1 算)
    promotionBoost: number; // 0.12 = 12% extra raise that year
    savingRate: number; // 0.55 = 月薪存 55%
    bonusMonths: number; // 年終月數中位數
  };
  yearlyBonus: { amount: number };
  returns: Record<Scenario, { stock: number; btc: number; cash: number }>;
  exchangeRate: { usdTwd: number }; // 試算內凍結匯率
  inflation: number; // 0.02 = 2%
  goalTwd: number; // 預設 10_000_000
};

/**
 * /api/prices 內部用的純價格資料(TWD per unit)。
 * us stocks 已在 server side 用即時 USD/TWD 換算成 TWD per share。
 *
 * `*Prev` = 昨日收盤(stocks)/ 24 小時前(crypto),都是 TWD per unit。
 * 為了讓「今日漲跌」純反映該檔的價格變化(不被 FX 變動污染),美股的
 * prev 在 server 用「同一支當下的 usdTwd」換算,而非昨日 FX。
 */
export type Prices = {
  tsmc: number | null;
  tsmcPrev: number | null;
  etf0050: number | null;
  etf0050Prev: number | null;
  googl: number | null;
  googlPrev: number | null;
  vti: number | null;
  vtiPrev: number | null;
  btc: number | null;
  btcPrev: number | null;
  eth: number | null;
  ethPrev: number | null;
  ada: number | null;
  adaPrev: number | null;
  doge: number | null;
  dogePrev: number | null;
  usdTwd: number | null;
  fetchedAt: string;
};

/**
 * /api/prices 對外的 response envelope。
 * 多了 _debug + errors,讓前端能診斷哪幾支上游異常。
 */
export type PricesResponse = Prices & {
  _debug: {
    sources: Record<string, 'ok' | 'failed' | 'fallback'>;
    latencyMs: Record<string, number>;
  };
  errors?: Array<{ source: string; message: string; httpCode?: number }>;
};

/**
 * 從 holding + price 算出來的衍生欄位(read-only,不存進 KV)。
 */
export type EnrichedHolding = Holding & {
  currentPriceTwd: number | null; // null 時表示無 API 對應 / API 失敗
  marketValueTwd: number;
  unrealizedPnlTwd: number;
  unrealizedPnlPct: number; // 0.05 = +5%
  hasPriceFallback: boolean; // true 表示用 costBasis 估算,而非真實即時價
  /** 昨日收盤的 TWD per unit;null = 沒拿到 prev / 無法計算。 */
  prevPriceTwd: number | null;
  /** 今日該檔對你部位的 TWD 漲跌(units × (price - prev))。 */
  todayChangeTwd: number;
  /** 今日該檔的價格漲跌幅(0.012 = +1.2%);null = 沒 prev 值。 */
  todayChangePct: number | null;
};

export type PortfolioSummary = {
  totalAssetTwd: number;
  totalCostBasisTwd: number;
  totalUnrealizedPnlTwd: number;
  totalUnrealizedPnlPct: number;
  /** 今日整體 TWD 漲跌(各檔 todayChangeTwd 加總)。 */
  totalTodayChangeTwd: number;
  /** 今日整體漲跌幅(相對於昨日總資產)。 */
  totalTodayChangePct: number;
  byType: Record<AssetType, { value: number; pct: number; count: number }>;
  goalProgressPct: number; // totalAssetTwd / config.goalTwd
};

export type SimulationYear = {
  year: number; // 2026, 2027, ...
  monthlySalary: number;
  totalAssetTwd: number;
  totalRealTwd: number; // 折現回 base year 購買力
  byType: Record<AssetType, number>;
};

export type SimulationResult = SimulationYear[];
