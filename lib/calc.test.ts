import { describe, expect, it } from 'vitest';
import {
  applyBuy,
  applySell,
  computeSummary,
  enrichHolding,
  simulate,
} from './calc';
import { defaultConfig } from './config';
import type { Holding, Prices } from './types';

const ts = '2026-05-05T00:00:00Z';

const samplePrices: Prices = {
  symbols: {
    '2330.TW': { currentTwd: 800, prevTwd: 790 },
    '0050.TW': { currentTwd: 200, prevTwd: 198 },
    GOOGL: { currentTwd: 5000, prevTwd: 4950 }, // 已是 server side 換算的 TWD per share
    VTI: { currentTwd: 1600, prevTwd: 1590 },
    BTC: { currentTwd: 1_700_000, prevTwd: 1_680_000 }, // TWD per BTC
    ETH: { currentTwd: 100_000, prevTwd: 98_000 },
    ADA: { currentTwd: 18, prevTwd: 17.5 },
    DOGE: { currentTwd: 9, prevTwd: 8.7 },
  },
  usdTwd: 32,
  fetchedAt: ts,
};

function mkHolding(p: Partial<Holding>): Holding {
  return {
    id: 'h1',
    type: 'tw_stock',
    symbol: '2330.TW',
    displayName: '台積電',
    units: 0,
    costBasisTwd: 0,
    updatedAt: ts,
    ...p,
  };
}

describe('enrichHolding', () => {
  it('1. tw_stock: units × price = market value, P&L = market - cost', () => {
    const h = mkHolding({
      type: 'tw_stock',
      symbol: '2330.TW',
      units: 30,
      costBasisTwd: 22_000,
    });
    const e = enrichHolding(h, samplePrices);
    expect(e.currentPriceTwd).toBe(800);
    expect(e.marketValueTwd).toBe(24_000);
    expect(e.unrealizedPnlTwd).toBe(2_000);
    expect(e.unrealizedPnlPct).toBeCloseTo(2_000 / 22_000, 6);
    expect(e.hasPriceFallback).toBe(false);
  });

  it('2. crypto BTC: 0.05 × 1_700_000 = 85_000', () => {
    const h = mkHolding({
      type: 'crypto',
      symbol: 'BTC',
      units: 0.05,
      costBasisTwd: 80_000,
    });
    const e = enrichHolding(h, samplePrices);
    expect(e.marketValueTwd).toBe(85_000);
    expect(e.unrealizedPnlTwd).toBe(5_000);
  });

  it('3. cash_twd: price=1, market value = units, no P&L', () => {
    const h = mkHolding({
      type: 'cash_twd',
      symbol: 'TWD-Bank',
      units: 200_000,
      costBasisTwd: 200_000,
    });
    const e = enrichHolding(h, samplePrices);
    expect(e.currentPriceTwd).toBe(1);
    expect(e.marketValueTwd).toBe(200_000);
    expect(e.unrealizedPnlTwd).toBe(0);
  });

  it('3a. cash_usd: units in USD, market value = units × usdTwd rate', () => {
    const h = mkHolding({
      type: 'cash_usd',
      symbol: 'USD-Cash',
      units: 2_200,
      costBasisTwd: 70_000,
    });
    const e = enrichHolding(h, samplePrices);
    expect(e.currentPriceTwd).toBe(32);
    expect(e.marketValueTwd).toBe(2_200 * 32);
    expect(e.unrealizedPnlTwd).toBe(70_400 - 70_000);
  });

  it('4. price=null fallback: trust uses costBasis, hasPriceFallback=true', () => {
    const h = mkHolding({
      type: 'trust',
      symbol: 'fubon-trust',
      units: 50_000, // ignored when price=null
      costBasisTwd: 50_000,
    });
    const e = enrichHolding(h, samplePrices);
    expect(e.currentPriceTwd).toBeNull();
    expect(e.marketValueTwd).toBe(50_000); // = costBasis
    expect(e.unrealizedPnlTwd).toBe(0);
    expect(e.hasPriceFallback).toBe(true);
  });

  it('4a. price=null fallback for stock when API failed', () => {
    const h = mkHolding({
      type: 'tw_stock',
      symbol: '2330.TW',
      units: 30,
      costBasisTwd: 22_000,
    });
    // 模擬 API 沒回該 symbol(removed from Record)
    const { '2330.TW': _omit, ...remaining } = samplePrices.symbols;
    void _omit;
    const failedPrices: Prices = {
      ...samplePrices,
      symbols: remaining,
    };
    const e = enrichHolding(h, failedPrices);
    expect(e.currentPriceTwd).toBeNull();
    expect(e.marketValueTwd).toBe(22_000);
    expect(e.hasPriceFallback).toBe(true);
  });
});

describe('applyBuy', () => {
  it('5. units + costBasis are summed', () => {
    const h = mkHolding({ units: 30, costBasisTwd: 22_000 });
    const after = applyBuy(h, 10, 8_500);
    expect(after.units).toBe(40);
    expect(after.costBasisTwd).toBe(30_500);
    expect(after.updatedAt).not.toBe(ts);
  });

  it('5a. negative input throws', () => {
    const h = mkHolding({});
    expect(() => applyBuy(h, -1, 0)).toThrow();
    expect(() => applyBuy(h, 0, -1)).toThrow();
  });
});

describe('applySell', () => {
  it('6. avg cost removed; realized P&L accumulated', () => {
    const h = mkHolding({ units: 100, costBasisTwd: 80_000 }); // avg cost = 800
    const after = applySell(h, 30, 25_000); // sell 30 shares @ 25000 TWD
    expect(after.units).toBe(70);
    expect(after.costBasisTwd).toBe(80_000 - 800 * 30); // = 56_000
    expect(after.realizedPnlTwd).toBeCloseTo(25_000 - 800 * 30, 6); // = 1_000
  });

  it('6a. sell all → costBasis = 0', () => {
    const h = mkHolding({ units: 100, costBasisTwd: 80_000 });
    const after = applySell(h, 100, 90_000);
    expect(after.units).toBe(0);
    expect(after.costBasisTwd).toBeCloseTo(0, 6);
    expect(after.realizedPnlTwd).toBeCloseTo(10_000, 6);
  });

  it('6b. oversell throws', () => {
    const h = mkHolding({ units: 10, costBasisTwd: 8_000 });
    expect(() => applySell(h, 11, 9_000)).toThrow();
  });
});

describe('computeSummary', () => {
  it('7. multiple holdings summed; byType breakdown; goal progress', () => {
    const enriched = [
      enrichHolding(mkHolding({ type: 'tw_stock', symbol: '2330.TW', units: 30, costBasisTwd: 22_000 }), samplePrices),
      enrichHolding(mkHolding({ id: 'h2', type: 'crypto', symbol: 'BTC', units: 0.05, costBasisTwd: 80_000 }), samplePrices),
      enrichHolding(mkHolding({ id: 'h3', type: 'cash_twd', symbol: 'TWD-Bank', units: 200_000, costBasisTwd: 200_000 }), samplePrices),
    ];
    const sum = computeSummary(enriched, 1_000_000);

    // 24_000 + 85_000 + 200_000 = 309_000
    expect(sum.totalAssetTwd).toBe(309_000);
    expect(sum.totalCostBasisTwd).toBe(302_000);
    expect(sum.totalUnrealizedPnlTwd).toBe(7_000);
    expect(sum.byType.tw_stock.value).toBe(24_000);
    expect(sum.byType.crypto.value).toBe(85_000);
    expect(sum.byType.cash_twd.value).toBe(200_000);
    expect(sum.byType.tw_stock.pct).toBeCloseTo(24_000 / 309_000, 4);
    expect(sum.goalProgressPct).toBeCloseTo(0.309, 4);
  });

  it('7a. empty portfolio → zeros, no NaN', () => {
    const sum = computeSummary([], 1_000_000);
    expect(sum.totalAssetTwd).toBe(0);
    expect(sum.totalUnrealizedPnlPct).toBe(0);
    expect(sum.goalProgressPct).toBe(0);
  });
});

describe('simulate', () => {
  it('8. t=0 baseline: year 1 result has all asset types tracked', () => {
    const holdings: Holding[] = [
      mkHolding({ type: 'tw_stock', symbol: '2330.TW', units: 30, costBasisTwd: 22_000, monthlyAutoBuyTwd: 5000 }),
      mkHolding({ id: 'h2', type: 'cash_twd', symbol: 'TWD-Bank', units: 100_000, costBasisTwd: 100_000, monthlyAutoBuyTwd: 6700 }),
    ];
    const result = simulate(holdings, defaultConfig, 'neutral', 1);
    expect(result).toHaveLength(1);
    expect(result[0].year).toBe(2027); // startDate=2026, +1
    expect(result[0].totalAssetTwd).toBeGreaterThan(0);
    expect(result[0].byType.tw_stock).toBeGreaterThan(22_000);
    expect(result[0].byType.cash_twd).toBeGreaterThan(100_000);
  });

  it('9. t=120 (10 years) salary correctly compounded with promotion', () => {
    const result = simulate([], defaultConfig, 'neutral', 10);
    expect(result).toHaveLength(10);
    // year 10 monthly salary calculation:
    // years 1-3: × 1.05 each
    // year 4 (promotion): × (1 + 0.05 + 0.12) = × 1.17
    // years 5-10: × 1.05 each (6 times)
    // total: 52000 × 1.05^9 × 1.17
    const expectedYear10Salary = 52_000 * Math.pow(1.05, 9) * 1.17;
    expect(result[9].monthlySalary).toBeCloseTo(expectedYear10Salary, 0);
  });

  it('10. negative crypto return → BTC clamped to >= 0', () => {
    const holdings: Holding[] = [
      mkHolding({ type: 'crypto', symbol: 'BTC', units: 0.05, costBasisTwd: 100_000 }),
    ];
    const cfg = {
      ...defaultConfig,
      returns: {
        ...defaultConfig.returns,
        neutral: { ...defaultConfig.returns.neutral, btc: -0.5 },
      },
    };
    const result = simulate(holdings, cfg, 'neutral', 5);
    // 5 years of -50% should drive BTC value down but never negative
    for (const y of result) {
      expect(y.byType.crypto).toBeGreaterThanOrEqual(0);
    }
    // and should be substantially less than starting cost
    expect(result[result.length - 1].byType.crypto).toBeLessThan(100_000);
  });

  it('10a. zero salary edge case: only existing holdings compound', () => {
    const holdings: Holding[] = [
      mkHolding({ type: 'cash_twd', symbol: 'TWD-Bank', units: 100_000, costBasisTwd: 100_000 }),
    ];
    const cfg = {
      ...defaultConfig,
      salary: { ...defaultConfig.salary, startMonthly: 0 },
      yearlyBonus: { amount: 0 },
    };
    const result = simulate(holdings, cfg, 'conservative', 1);
    // year 1: 100_000 × 1.015 ≈ 101_500 (1.5% cash compound)
    expect(result[0].byType.cash_twd).toBeGreaterThan(100_000);
    expect(result[0].byType.cash_twd).toBeLessThan(102_000);
  });

  it('totalRealTwd ≤ totalAssetTwd (inflation discounts purchasing power)', () => {
    const holdings: Holding[] = [
      mkHolding({ type: 'cash_twd', symbol: 'TWD-Bank', units: 100_000, costBasisTwd: 100_000 }),
    ];
    const result = simulate(holdings, defaultConfig, 'neutral', 5);
    for (const y of result) {
      expect(y.totalRealTwd).toBeLessThanOrEqual(y.totalAssetTwd);
    }
  });
});
