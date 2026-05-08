/**
 * Monthly trigger — 月份切換偵測 + streak 計算 + 第一次孵化(Phase 2)。
 *
 * 設計原則(GDD §32.9 + Phase 2 checkpoint):
 * - Lazy on next-open,不用 cron
 * - Asia/Taipei timezone safe(toTaipeiYYYYMM)
 * - Idempotent:同月內重複 GET 不會二次 trigger
 * - Multi-month 補單:玩家失聯 N 月回來,monthsTriggered 列出全部
 * - 第一次孵化:lastMonth === '' && 沒收集任何 pikmin → 孵化第一隻
 *
 * Pure function,沒 redis / fetch 副作用,純算入算出 → 完整 testable。
 */

import type { Holdings } from './types';
import type {
  IslandState,
  MonthlyTriggerResult,
  Pikmin,
} from './island-types';
import { computeStreak, listMissedMonths, toTaipeiYYYYMM } from './streak-calc';
import { spawnFirstPikmin } from './pikmin-spawn';

/**
 * 套用 monthly trigger。
 *
 * @param state 當前 IslandState(讀進來的)
 * @param holdings V1 holdings(用來決定第一隻 pikmin 顏色,可為 null)
 * @param nowIso 當下時間 ISO 字串(server side `new Date().toISOString()`)
 * @returns { nextState, trigger } — trigger 為 null 表示同月內 / 無變化
 */
export function applyMonthlyTrigger(
  state: IslandState,
  holdings: Holdings | null,
  nowIso: string,
): { nextState: IslandState; trigger: MonthlyTriggerResult | null } {
  const nowMonth = toTaipeiYYYYMM(nowIso);
  const lastMonth = state.tracks.time.lastMonthYYYYMM;

  // 同月內 → 只更新 lastOpenedAt + daysOpened(若是新的一天)
  if (nowMonth && nowMonth === lastMonth) {
    return {
      nextState: bumpDailyOpen(state, nowIso),
      trigger: null,
    };
  }

  // nowMonth 解析失敗 — 保險起見不動
  if (!nowMonth) {
    return { nextState: state, trigger: null };
  }

  // 新月份觸發
  const monthsTriggered = listMissedMonths(lastMonth, nowMonth);

  // Streak 計算
  const streakResult = computeStreak(
    state.tracks.time.currentStreak,
    lastMonth,
    nowMonth,
  );

  // 第一次月份切換 + 還沒孵化過 → 孵化第一隻 pikmin
  let newPikmin: Pikmin | null = null;
  if (lastMonth === '' && state.collections.pikmin.length === 0) {
    newPikmin = spawnFirstPikmin(holdings, nowIso);
  }

  // 寫進 next state
  const nextState: IslandState = {
    ...state,
    tracks: {
      ...state.tracks,
      time: {
        ...state.tracks.time,
        currentStreak: streakResult.streak,
        longestStreak: Math.max(streakResult.streak, state.tracks.time.longestStreak),
        lastOpenedAt: nowIso,
        lastMonthYYYYMM: nowMonth,
        daysOpened: state.tracks.time.daysOpened + 1,
      },
    },
    collections: newPikmin
      ? {
          ...state.collections,
          pikmin: [...state.collections.pikmin, newPikmin],
        }
      : state.collections,
  };

  return {
    nextState,
    trigger: {
      monthsTriggered,
      streakResult,
      newPikmin,
    },
  };
}

/**
 * 同月內打開:更新 lastOpenedAt + daysOpened(若是台北時區新的一天)。
 * 不動 streak 跟 month。
 */
function bumpDailyOpen(state: IslandState, nowIso: string): IslandState {
  const lastOpened = state.tracks.time.lastOpenedAt;
  const sameDay = isSameTaipeiDay(lastOpened, nowIso);

  if (sameDay) {
    // 同一天再開,只更新 lastOpenedAt 為最新
    return {
      ...state,
      tracks: {
        ...state.tracks,
        time: { ...state.tracks.time, lastOpenedAt: nowIso },
      },
    };
  }

  // 新的一天 → daysOpened +1
  return {
    ...state,
    tracks: {
      ...state.tracks,
      time: {
        ...state.tracks.time,
        lastOpenedAt: nowIso,
        daysOpened: state.tracks.time.daysOpened + 1,
      },
    },
  };
}

/**
 * 兩個 ISO 字串是否在同一個台北日。
 */
function isSameTaipeiDay(aIso: string, bIso: string): boolean {
  if (!aIso || !bIso) return false;
  return toTaipeiYYYYMMDD(aIso) === toTaipeiYYYYMMDD(bIso);
}

function toTaipeiYYYYMMDD(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}-${m}-${day}`;
}
