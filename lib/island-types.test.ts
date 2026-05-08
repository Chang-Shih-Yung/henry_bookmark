import { describe, expect, it } from 'vitest';
import {
  defaultIslandState,
  mergeIslandState,
  sanitizeForVisitor,
  type IslandState,
} from './island-types';

describe('defaultIslandState', () => {
  it('schemaVersion 是 1', () => {
    const s = defaultIslandState();
    expect(s.schemaVersion).toBe(1);
  });

  it('mascot 預設值符合 onboarding 假設', () => {
    const s = defaultIslandState();
    expect(s.profile.mascot.gender).toBe('none');
    expect(s.profile.mascot.age).toBe(25);
  });

  it('streak 從 0 開始', () => {
    const s = defaultIslandState();
    expect(s.tracks.time.currentStreak).toBe(0);
    expect(s.tracks.time.longestStreak).toBe(0);
    expect(s.tracks.time.lastMonthYYYYMM).toBe('');
  });

  it('mood 預設 50(中性)', () => {
    const s = defaultIslandState();
    expect(s.tracks.mood.currentMood).toBe(50);
  });

  it('收藏為空陣列(不是 undefined)', () => {
    const s = defaultIslandState();
    expect(s.collections.pikmin).toEqual([]);
    expect(s.collections.items).toEqual([]);
    expect(s.goals).toEqual([]);
  });

  it('沒走完 onboarding,onboardedAt = null', () => {
    const s = defaultIslandState();
    expect(s.profile.onboardedAt).toBeNull();
  });

  it('每次呼叫產生新 object(不共享 reference)', () => {
    const a = defaultIslandState();
    const b = defaultIslandState();
    expect(a).not.toBe(b);
    expect(a.collections).not.toBe(b.collections);
    a.collections.pikmin.push({
      id: 'x',
      color: 'green',
      stage: 'egg',
      birthAt: '',
    });
    expect(b.collections.pikmin).toEqual([]);
  });
});

describe('mergeIslandState', () => {
  const base: IslandState = defaultIslandState();

  it('top-level field replace', () => {
    const result = mergeIslandState(base, {
      goals: [{ id: 'g1', term: 'mid', label: '買房', targetTwd: 8000000 }],
    });
    expect(result.goals).toHaveLength(1);
    expect(result.goals[0].id).toBe('g1');
    // 其他不動
    expect(result.profile.pikminTribeName).toBe(base.profile.pikminTribeName);
  });

  it('profile 部分 patch 不蓋掉其他欄位', () => {
    const result = mergeIslandState(base, {
      profile: {
        ...base.profile,
        pikminTribeName: '青豆',
      },
    });
    expect(result.profile.pikminTribeName).toBe('青豆');
    expect(result.profile.mascot.age).toBe(25);  // 沒被蓋
    expect(result.profile.inflation).toBe(0.02);
  });

  it('tracks.time 部分 patch 保留其他 track', () => {
    const result = mergeIslandState(base, {
      tracks: {
        ...base.tracks,
        time: {
          ...base.tracks.time,
          currentStreak: 5,
          lastMonthYYYYMM: '2026-05',
        },
      },
    });
    expect(result.tracks.time.currentStreak).toBe(5);
    expect(result.tracks.time.lastMonthYYYYMM).toBe('2026-05');
    expect(result.tracks.mood.currentMood).toBe(50);  // 其他 track 沒動
    expect(result.tracks.action.totalActions).toBe(0);
  });

  it('schemaVersion 永遠回 1(不可被 patch 蓋)', () => {
    // @ts-expect-error 測試不正當 patch
    const result = mergeIslandState(base, { schemaVersion: 99 });
    expect(result.schemaVersion).toBe(1);
  });

  it('空 patch 等同 deep clone', () => {
    const result = mergeIslandState(base, {});
    expect(result).toEqual(base);
    expect(result).not.toBe(base);  // 但是新 object
  });
});

describe('sanitizeForVisitor — privacy boundary', () => {
  const fullState: IslandState = (() => {
    const s = defaultIslandState();
    s.profile.pikminTribeName = '青豆';
    s.profile.mascot.age = 28;
    s.profile.privacySettings.allowFriendVisit = true;
    s.profile.onboardedAt = '2026-01-01T00:00:00Z';
    s.tracks.time.currentStreak = 12;
    s.tracks.time.daysOpened = 365;
    s.tracks.money.totalAccumulatedTwd = 1500000;
    s.tracks.money.unlockedStoryChapters = ['ch1', 'ch2'];
    s.tracks.mood.currentMood = 80;
    s.tracks.action.totalActions = 200;
    s.goals = [{ id: 'g1', term: 'mid', label: '買房', targetTwd: 8000000 }];
    s.collections.pikmin = [
      { id: 'p1', color: 'violet', stage: 'mature', birthAt: '2026-01-01T00:00:00Z' },
    ];
    s.collections.items = [
      { id: 'i1', category: 'stamp', unlockedAt: '2026-01-01T00:00:00Z' },
    ];
    return s;
  })();

  it('看得到 mascot + tribe name', () => {
    const v = sanitizeForVisitor(fullState);
    expect(v.profile.mascot.age).toBe(28);
    expect(v.profile.pikminTribeName).toBe('青豆');
  });

  it('看得到 streak(時間是 cheat-proof)', () => {
    const v = sanitizeForVisitor(fullState);
    expect(v.tracks.time.currentStreak).toBe(12);
  });

  it('看得到 collections(視覺資產)', () => {
    const v = sanitizeForVisitor(fullState);
    expect(v.collections.pikmin).toHaveLength(1);
    expect(v.collections.items).toHaveLength(1);
  });

  it('看不到 money(金額隱私)', () => {
    const v = sanitizeForVisitor(fullState);
    expect((v.tracks as { money?: unknown }).money).toBeUndefined();
  });

  it('看不到 mood / action(行為隱私)', () => {
    const v = sanitizeForVisitor(fullState);
    expect((v.tracks as { mood?: unknown }).mood).toBeUndefined();
    expect((v.tracks as { action?: unknown }).action).toBeUndefined();
  });

  it('看不到 goals(目標隱私)', () => {
    const v = sanitizeForVisitor(fullState);
    expect((v as { goals?: unknown }).goals).toBeUndefined();
  });

  it('看不到 onboardedAt / privacySettings / inflation(個人設定)', () => {
    const v = sanitizeForVisitor(fullState);
    const p = v.profile as { onboardedAt?: unknown; privacySettings?: unknown; inflation?: unknown };
    expect(p.onboardedAt).toBeUndefined();
    expect(p.privacySettings).toBeUndefined();
    expect(p.inflation).toBeUndefined();
  });

  it('看不到 daysOpened / longestStreak(只給 currentStreak)', () => {
    const v = sanitizeForVisitor(fullState);
    expect((v.tracks.time as { daysOpened?: unknown }).daysOpened).toBeUndefined();
    expect((v.tracks.time as { longestStreak?: unknown }).longestStreak).toBeUndefined();
  });
});
