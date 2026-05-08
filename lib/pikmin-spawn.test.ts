import { describe, expect, it } from 'vitest';
import {
  buildSpawnContext,
  selectPikminColor,
  spawnFirstPikmin,
} from './pikmin-spawn';
import type { Holdings, Holding } from './types';

function mkHolding(
  type: Holding['type'],
  symbol: string,
  costBasisTwd: number,
): Holding {
  return {
    id: `h-${symbol}`,
    type,
    symbol,
    displayName: symbol,
    units: 1,
    costBasisTwd,
    updatedAt: '2026-05-01T00:00:00Z',
  };
}

function mkHoldings(items: Holding[]): Holdings {
  return {
    schemaVersion: 2,
    items,
    lastModified: '2026-05-01T00:00:00Z',
  };
}

describe('buildSpawnContext', () => {
  it('null holdings → 空 byType', () => {
    expect(buildSpawnContext(null)).toEqual({ byType: {} });
  });

  it('空 items → 空 byType', () => {
    expect(buildSpawnContext(mkHoldings([]))).toEqual({ byType: {} });
  });

  it('累計同類別 cost', () => {
    const h = mkHoldings([
      mkHolding('tw_stock', '2330', 100000),
      mkHolding('tw_stock', '2454', 50000),
    ]);
    const ctx = buildSpawnContext(h);
    expect(ctx.byType.tw_stock).toBe(150000);
  });

  it('多類別分別累計', () => {
    const h = mkHoldings([
      mkHolding('tw_stock', '2330', 100000),
      mkHolding('us_stock', 'GOOGL', 80000),
      mkHolding('crypto', 'BTC', 50000),
    ]);
    const ctx = buildSpawnContext(h);
    expect(ctx.byType.tw_stock).toBe(100000);
    expect(ctx.byType.us_stock).toBe(80000);
    expect(ctx.byType.crypto).toBe(50000);
  });

  it('忽略 0 / 負 / NaN cost', () => {
    const h = mkHoldings([
      mkHolding('tw_stock', 'A', 0),
      mkHolding('us_stock', 'B', -100),
      { ...mkHolding('crypto', 'C', NaN), costBasisTwd: NaN },
    ]);
    const ctx = buildSpawnContext(h);
    expect(ctx.byType).toEqual({});
  });
});

describe('selectPikminColor', () => {
  it('null → green(預設台股)', () => {
    expect(selectPikminColor(null)).toBe('green');
  });

  it('空 holdings → green', () => {
    expect(selectPikminColor(mkHoldings([]))).toBe('green');
  });

  it('純台股 → green', () => {
    expect(
      selectPikminColor(mkHoldings([mkHolding('tw_stock', '2330', 100000)])),
    ).toBe('green');
  });

  it('純美股 → violet', () => {
    expect(
      selectPikminColor(mkHoldings([mkHolding('us_stock', 'GOOGL', 100000)])),
    ).toBe('violet');
  });

  it('純加密 → orange', () => {
    expect(
      selectPikminColor(mkHoldings([mkHolding('crypto', 'BTC', 100000)])),
    ).toBe('orange');
  });

  it('現金 TWD → cyan', () => {
    expect(
      selectPikminColor(mkHoldings([mkHolding('cash_twd', 'TWD', 100000)])),
    ).toBe('cyan');
  });

  it('現金 USD → cyan(同 TWD 共用 cyan)', () => {
    expect(
      selectPikminColor(mkHoldings([mkHolding('cash_usd', 'USD', 100000)])),
    ).toBe('cyan');
  });

  it('信託 → grey', () => {
    expect(
      selectPikminColor(mkHoldings([mkHolding('trust', 'TRUST1', 100000)])),
    ).toBe('grey');
  });

  it('混合占比最大的台股 → green', () => {
    const h = mkHoldings([
      mkHolding('tw_stock', '2330', 200000),  // 67%
      mkHolding('us_stock', 'GOOGL', 80000),
      mkHolding('crypto', 'BTC', 20000),
    ]);
    expect(selectPikminColor(h)).toBe('green');
  });

  it('混合占比最大的美股 → violet', () => {
    const h = mkHoldings([
      mkHolding('tw_stock', '2330', 50000),
      mkHolding('us_stock', 'GOOGL', 200000),  // 80%
    ]);
    expect(selectPikminColor(h)).toBe('violet');
  });

  it('全部占比相等(平手) → 按 ORDER 順序選台股', () => {
    const h = mkHoldings([
      mkHolding('tw_stock', '2330', 50000),
      mkHolding('us_stock', 'GOOGL', 50000),
    ]);
    expect(selectPikminColor(h)).toBe('green');
  });

  it('全部 cost = 0 → green', () => {
    const h = mkHoldings([
      mkHolding('tw_stock', 'A', 0),
      mkHolding('us_stock', 'B', 0),
    ]);
    expect(selectPikminColor(h)).toBe('green');
  });
});

describe('spawnFirstPikmin', () => {
  it('產生 sprout stage(不是 egg)', () => {
    const p = spawnFirstPikmin(null, '2026-05-08T00:00:00Z');
    expect(p.stage).toBe('sprout');
  });

  it('用 holdings 決定顏色', () => {
    const h = mkHoldings([mkHolding('crypto', 'BTC', 100000)]);
    const p = spawnFirstPikmin(h, '2026-05-08T00:00:00Z');
    expect(p.color).toBe('orange');
  });

  it('birthAt 是傳入的 ISO', () => {
    const iso = '2026-05-08T00:00:00.000Z';
    const p = spawnFirstPikmin(null, iso);
    expect(p.birthAt).toBe(iso);
  });

  it('id 唯一', () => {
    const a = spawnFirstPikmin(null, '2026-05-08T00:00:00Z');
    const b = spawnFirstPikmin(null, '2026-05-08T00:00:00Z');
    expect(a.id).not.toBe(b.id);
  });
});
