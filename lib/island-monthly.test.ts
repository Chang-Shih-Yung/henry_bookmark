import { describe, expect, it } from 'vitest';
import { applyMonthlyTrigger } from './island-monthly';
import { defaultIslandState, type IslandState } from './island-types';
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
  return { schemaVersion: 2, items, lastModified: '2026-05-01T00:00:00Z' };
}

function mkBaseState(overrides: Partial<IslandState['tracks']['time']> = {}): IslandState {
  const s = defaultIslandState();
  s.tracks.time = { ...s.tracks.time, ...overrides };
  return s;
}

describe('applyMonthlyTrigger — first month', () => {
  it('第一次月份切換 + 沒收集 pikmin → 孵化第一隻 + streak = 1', () => {
    const state = mkBaseState({ lastMonthYYYYMM: '' });
    const holdings = mkHoldings([mkHolding('us_stock', 'GOOGL', 100000)]);
    const { nextState, trigger } = applyMonthlyTrigger(
      state,
      holdings,
      '2026-05-08T03:00:00Z',
    );

    expect(trigger).not.toBeNull();
    expect(trigger?.streakResult).toEqual({ streak: 1, broke: false });
    expect(trigger?.newPikmin).not.toBeNull();
    expect(trigger?.newPikmin?.color).toBe('violet'); // GOOGL = us_stock
    expect(trigger?.newPikmin?.stage).toBe('sprout');

    expect(nextState.collections.pikmin).toHaveLength(1);
    expect(nextState.tracks.time.currentStreak).toBe(1);
    expect(nextState.tracks.time.longestStreak).toBe(1);
    expect(nextState.tracks.time.lastMonthYYYYMM).toBe('2026-05');
    expect(nextState.tracks.time.daysOpened).toBe(1);
  });

  it('null holdings → 孵化 green(預設)', () => {
    const state = mkBaseState({ lastMonthYYYYMM: '' });
    const { trigger } = applyMonthlyTrigger(state, null, '2026-05-08T03:00:00Z');
    expect(trigger?.newPikmin?.color).toBe('green');
  });

  it('已有 pikmin(理論不會發生但保險)→ 不再孵化', () => {
    const state = mkBaseState({ lastMonthYYYYMM: '' });
    state.collections.pikmin = [
      { id: 'p1', color: 'green', stage: 'sprout', birthAt: '2026-05-01T00:00:00Z' },
    ];
    const { trigger, nextState } = applyMonthlyTrigger(
      state,
      null,
      '2026-05-08T03:00:00Z',
    );
    expect(trigger?.newPikmin).toBeNull();
    expect(nextState.collections.pikmin).toHaveLength(1); // 沒新增
  });
});

describe('applyMonthlyTrigger — subsequent months', () => {
  it('連續下個月 → streak +1、不再孵化', () => {
    const state = mkBaseState({ lastMonthYYYYMM: '2026-04', currentStreak: 1 });
    state.collections.pikmin = [
      { id: 'p1', color: 'green', stage: 'sprout', birthAt: '2026-04-01T00:00:00Z' },
    ];
    const { nextState, trigger } = applyMonthlyTrigger(
      state,
      null,
      '2026-05-08T03:00:00Z',
    );

    expect(trigger?.streakResult).toEqual({ streak: 2, broke: false });
    expect(trigger?.newPikmin).toBeNull();
    expect(nextState.tracks.time.currentStreak).toBe(2);
    expect(nextState.tracks.time.longestStreak).toBe(2);
    expect(nextState.collections.pikmin).toHaveLength(1);
  });

  it('斷一個月 → streak 歸 1 + broke flag,不再孵化', () => {
    const state = mkBaseState({
      lastMonthYYYYMM: '2026-03',
      currentStreak: 5,
      longestStreak: 5,
    });
    state.collections.pikmin = [
      { id: 'p1', color: 'green', stage: 'sprout', birthAt: '2026-03-01T00:00:00Z' },
    ];
    const { nextState, trigger } = applyMonthlyTrigger(
      state,
      null,
      '2026-05-08T03:00:00Z',
    );

    expect(trigger?.streakResult).toEqual({ streak: 1, broke: true });
    expect(nextState.tracks.time.currentStreak).toBe(1);
    expect(nextState.tracks.time.longestStreak).toBe(5); // 保留歷史最長
  });

  it('多月補單 monthsTriggered 列出全部', () => {
    const state = mkBaseState({ lastMonthYYYYMM: '2026-02' });
    const { trigger } = applyMonthlyTrigger(state, null, '2026-05-08T03:00:00Z');
    expect(trigger?.monthsTriggered).toEqual(['2026-03', '2026-04', '2026-05']);
  });

  it('跨年(12 → 1 月)streak 連續', () => {
    const state = mkBaseState({ lastMonthYYYYMM: '2026-12', currentStreak: 12 });
    state.collections.pikmin = [
      { id: 'p1', color: 'green', stage: 'sprout', birthAt: '2026-01-01T00:00:00Z' },
    ];
    const { trigger } = applyMonthlyTrigger(
      state,
      null,
      '2027-01-15T03:00:00Z',
    );
    expect(trigger?.streakResult).toEqual({ streak: 13, broke: false });
  });
});

describe('applyMonthlyTrigger — same month idempotency', () => {
  it('同月內重複 → trigger = null,不重複加 streak', () => {
    const state = mkBaseState({
      lastMonthYYYYMM: '2026-05',
      currentStreak: 1,
      lastOpenedAt: '2026-05-08T03:00:00Z',
      daysOpened: 1,
    });
    const { nextState, trigger } = applyMonthlyTrigger(
      state,
      null,
      '2026-05-08T05:00:00Z', // 同月、同台北日
    );

    expect(trigger).toBeNull();
    expect(nextState.tracks.time.currentStreak).toBe(1);
    expect(nextState.tracks.time.daysOpened).toBe(1); // 不重複加
    expect(nextState.tracks.time.lastOpenedAt).toBe('2026-05-08T05:00:00Z'); // 但更新 timestamp
  });

  it('同月新一天 → trigger = null 但 daysOpened +1', () => {
    const state = mkBaseState({
      lastMonthYYYYMM: '2026-05',
      currentStreak: 1,
      lastOpenedAt: '2026-05-08T03:00:00Z',
      daysOpened: 1,
    });
    const { nextState, trigger } = applyMonthlyTrigger(
      state,
      null,
      '2026-05-09T03:00:00Z',
    );

    expect(trigger).toBeNull();
    expect(nextState.tracks.time.daysOpened).toBe(2);
    expect(nextState.tracks.time.currentStreak).toBe(1); // streak 不動
  });
});

describe('applyMonthlyTrigger — timezone safety', () => {
  it('UTC 跨日邊界 → 用台北時間判斷月份', () => {
    // UTC May 31 23:30 = 台北 Jun 1 07:30 → 應該觸發新月份
    const state = mkBaseState({ lastMonthYYYYMM: '2026-05', currentStreak: 1 });
    const { trigger } = applyMonthlyTrigger(
      state,
      null,
      '2026-05-31T23:30:00Z',
    );
    expect(trigger).not.toBeNull();
    expect(trigger?.streakResult.streak).toBe(2);
  });

  it('UTC 凌晨但台北仍同月 → 不觸發', () => {
    // UTC May 1 02:00 = 台北 May 1 10:00 → 同月,不觸發 trigger
    const state = mkBaseState({ lastMonthYYYYMM: '2026-05', currentStreak: 1 });
    const { trigger } = applyMonthlyTrigger(
      state,
      null,
      '2026-05-01T02:00:00Z',
    );
    expect(trigger).toBeNull();
  });
});

describe('applyMonthlyTrigger — error guards', () => {
  it('壞 ISO 字串 → 不動 state、trigger null', () => {
    const state = mkBaseState({ lastMonthYYYYMM: '2026-05' });
    const { nextState, trigger } = applyMonthlyTrigger(state, null, 'not-a-date');
    expect(trigger).toBeNull();
    expect(nextState).toBe(state); // 直接回原 reference,沒做任何處理
  });
});
