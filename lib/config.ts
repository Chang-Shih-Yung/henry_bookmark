import type { Config } from './types';

/**
 * 預設試算參數。
 * 數字來自原始設計文件 office-hours 階段(Henry 富邦工作起薪 + 個人投資假設)。
 *
 * 單位說明:
 * - annualRaise / promotionBoost / savingRate / inflation:小數(0.05 = 5%)
 * - returns.*:小數,年化報酬(0.085 = 年化 8.5%)
 * - exchangeRate.usdTwd:試算內凍結值,即時換算才用 live API
 * - goalTwd:目標總資產,進度條基準
 */
export const defaultConfig: Config = {
  meta: {
    startDate: '2026-06-08',
    title: 'Henry Bookmark — 長期資產試算',
  },
  salary: {
    startMonthly: 52_000,
    annualRaise: 0.05, // 5% 年調薪
    promotionYear: 4, // 第 4 年升職
    promotionBoost: 0.12, // 升職那年額外 +12%
    savingRate: 0.55, // 存 55%
    bonusMonths: 5, // 年終 5 個月(中位數)
  },
  yearlyBonus: {
    amount: 375_000, // 年終獎金中位數估算
  },
  returns: {
    conservative: { stock: 0.06, btc: 0.05, cash: 0.015 },
    neutral: { stock: 0.085, btc: 0.15, cash: 0.015 },
    optimistic: { stock: 0.12, btc: 0.25, cash: 0.015 },
  },
  exchangeRate: { usdTwd: 32 },
  inflation: 0.02,
  goalTwd: 10_000_000, // 1000 萬目標
};
