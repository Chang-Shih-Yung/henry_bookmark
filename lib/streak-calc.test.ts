import { describe, expect, it } from 'vitest';
import {
  computeStreak,
  listMissedMonths,
  monthsBetween,
  toTaipeiYYYYMM,
} from './streak-calc';

describe('toTaipeiYYYYMM', () => {
  it('處理一般日期', () => {
    expect(toTaipeiYYYYMM('2026-05-15T10:00:00Z')).toBe('2026-05');
  });

  it('UTC 跟台北跨日邊界:UTC 23:30 May 31 = 台北 07:30 Jun 1', () => {
    // 這是關鍵 test — 證明 timezone 處理正確
    expect(toTaipeiYYYYMM('2026-05-31T23:30:00Z')).toBe('2026-06');
  });

  it('UTC 早上仍是台北同一天', () => {
    // 台北時間 May 15 早上 10 點 = UTC May 15 02:00
    expect(toTaipeiYYYYMM('2026-05-15T02:00:00Z')).toBe('2026-05');
  });

  it('壞 ISO 字串回空字串', () => {
    expect(toTaipeiYYYYMM('not-a-date')).toBe('');
  });
});

describe('monthsBetween', () => {
  it('同月 = 0', () => {
    expect(monthsBetween('2026-05', '2026-05')).toBe(0);
  });

  it('下一個月 = 1', () => {
    expect(monthsBetween('2026-05', '2026-06')).toBe(1);
  });

  it('跨年 12 → 1 月 = 1', () => {
    expect(monthsBetween('2026-12', '2027-01')).toBe(1);
  });

  it('跨年 12 → 3 月 = 3', () => {
    expect(monthsBetween('2026-12', '2027-03')).toBe(3);
  });

  it('倒退 = 負數', () => {
    expect(monthsBetween('2026-06', '2026-05')).toBe(-1);
  });

  it('空字串保護回 0', () => {
    expect(monthsBetween('', '2026-05')).toBe(0);
    expect(monthsBetween('2026-05', '')).toBe(0);
  });
});

describe('computeStreak', () => {
  it('第一次月扣:streak = 1', () => {
    expect(computeStreak(0, '', '2026-05')).toEqual({ streak: 1, broke: false });
  });

  it('同月不變', () => {
    expect(computeStreak(3, '2026-05', '2026-05')).toEqual({
      streak: 3,
      broke: false,
    });
  });

  it('連續下個月 +1', () => {
    expect(computeStreak(3, '2026-05', '2026-06')).toEqual({
      streak: 4,
      broke: false,
    });
  });

  it('跨年連續 +1', () => {
    expect(computeStreak(12, '2026-12', '2027-01')).toEqual({
      streak: 13,
      broke: false,
    });
  });

  it('斷一個月 → 歸零從 1 重新算 + broke flag', () => {
    expect(computeStreak(10, '2026-05', '2026-07')).toEqual({
      streak: 1,
      broke: true,
    });
  });

  it('斷半年 → 歸零', () => {
    expect(computeStreak(20, '2025-11', '2026-05')).toEqual({
      streak: 1,
      broke: true,
    });
  });

  it('系統時鐘倒退保險:streak 不動,不誤觸 broke', () => {
    expect(computeStreak(5, '2026-06', '2026-05')).toEqual({
      streak: 5,
      broke: false,
    });
  });
});

describe('listMissedMonths', () => {
  it('第一次無 prevMonth,只回 nowMonth', () => {
    expect(listMissedMonths('', '2026-05')).toEqual(['2026-05']);
  });

  it('連續下個月,只一個', () => {
    expect(listMissedMonths('2026-05', '2026-06')).toEqual(['2026-06']);
  });

  it('斷 2 個月,補 2 張', () => {
    expect(listMissedMonths('2026-03', '2026-05')).toEqual([
      '2026-04',
      '2026-05',
    ]);
  });

  it('跨年補單:11 → 2027-02 補 3 張', () => {
    expect(listMissedMonths('2026-11', '2027-02')).toEqual([
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });

  it('同月內回空陣列(不重複觸發)', () => {
    expect(listMissedMonths('2026-05', '2026-05')).toEqual([]);
  });

  it('時鐘倒退回空陣列', () => {
    expect(listMissedMonths('2026-06', '2026-05')).toEqual([]);
  });
});
