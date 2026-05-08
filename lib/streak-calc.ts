/**
 * Streak 計算 — 連續月扣紀錄的核心邏輯。
 *
 * 設計原則(GDD §32.9):
 * - Timezone-safe: 用 Asia/Taipei,不用 UTC(否則月底前一天 trigger 提早)
 * - Streak break: 跨月斷一個月 → 歸零;同月內多次打開不影響
 * - 跨年邊界: 12 → 1 月跨年,只要連續就 +1
 *
 * 為什麼分開檔:Phase 2 月扣 trigger 會大量呼叫,獨立 testable。
 */

const TZ = 'Asia/Taipei';

/**
 * 把 ISO 字串轉成台北時區的 YYYY-MM 字串。
 * V1 既有 lib/format.ts 沒有時區感知 helper,新增這個專給遊戲層用。
 */
export function toTaipeiYYYYMM(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  // Intl.DateTimeFormat 是處理時區唯一可靠的辦法
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  return `${year}-${month}`;
}

/**
 * 算兩個 YYYY-MM 字串相差幾個月。
 * 用於 streak break 偵測:相差 1 → 連續,相差 > 1 → 斷
 */
export function monthsBetween(fromYYYYMM: string, toYYYYMM: string): number {
  if (!fromYYYYMM || !toYYYYMM) return 0;
  const [fy, fm] = fromYYYYMM.split('-').map(Number);
  const [ty, tm] = toYYYYMM.split('-').map(Number);
  if (!Number.isFinite(fy) || !Number.isFinite(fm) || !Number.isFinite(ty) || !Number.isFinite(tm)) {
    return 0;
  }
  return (ty - fy) * 12 + (tm - fm);
}

/**
 * 計算新的 streak 值。
 *
 * @param prevStreak 之前的 currentStreak
 * @param prevMonth 上次月扣月份(YYYY-MM,空字串表示沒月扣過)
 * @param nowMonth 當前月份(YYYY-MM)
 * @returns { streak, broke } 新的 streak + 是否中斷(觸發特別明信片)
 */
export function computeStreak(
  prevStreak: number,
  prevMonth: string,
  nowMonth: string,
): { streak: number; broke: boolean } {
  // 第一次月扣 → streak = 1
  if (!prevMonth) return { streak: 1, broke: false };

  const gap = monthsBetween(prevMonth, nowMonth);

  // 同月內 → 不變
  if (gap === 0) return { streak: prevStreak, broke: false };

  // 連續下個月 → +1
  if (gap === 1) return { streak: prevStreak + 1, broke: false };

  // 斷掉 → 歸零(從 1 重新算,因為這次本身算第一次)
  if (gap > 1) return { streak: 1, broke: true };

  // gap < 0 → 系統時鐘倒退?保險起見保留 streak 不動
  return { streak: prevStreak, broke: false };
}

/**
 * 列出從 prevMonth 到 nowMonth 之間應該補的所有月份(不含 prevMonth,含 nowMonth)。
 * 例:prevMonth="2026-03", nowMonth="2026-05" → ["2026-04", "2026-05"]
 *
 * 用途:玩家失聯 2 個月後打開,server 應該補 2 張月扣明信片(§32.9 多月補單)。
 */
export function listMissedMonths(prevMonth: string, nowMonth: string): string[] {
  if (!prevMonth) return [nowMonth];
  const gap = monthsBetween(prevMonth, nowMonth);
  if (gap <= 0) return [];

  const [py, pm] = prevMonth.split('-').map(Number);
  const result: string[] = [];
  let y = py;
  let m = pm;
  for (let i = 0; i < gap; i++) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    result.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return result;
}
