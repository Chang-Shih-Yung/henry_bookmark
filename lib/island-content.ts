/**
 * 文案集中地(GDD §16/17/24 + Phase 2 minimal)。
 *
 * 設計原則:
 * - 30 種 mascot 隨機事件腳本(打開 island 隨機選 1 個顯示 toast)
 * - 風格嚴格 Pikmin Bloom:動植物動詞、不情勒、不教育、不解釋
 * - {tribe} 變數會在 render 時 inject(預設族名 = 「小苗」)
 *
 * Phase 5+ 會擴增到 100+ 種,本檔是 30 種骨架。
 */

import type { Pikmin } from './island-types';

/* ============================================================
   Mascot 隨機事件腳本(GDD §24)
   ============================================================ */

export const PIKMIN_RANDOM_EVENTS: ReadonlyArray<string> = [
  '{tribe} 在湖邊釣魚,沒釣到任何東西。',
  '{tribe} 試圖搬一根樹枝,搬不動,坐下來休息。',
  '島上飛過一隻紙鶴。',
  '一片葉子飄落,落在 {tribe} 頭上。',
  '{tribe} 在屋簷下打瞌睡。',
  '{tribe} 學會打哈欠了。',
  '海邊有一個漂流瓶。',
  '兩隻小精靈在玩石頭。',
  '島上下了一場毛毛雨,5 秒後停了。',
  '起霧了。一切變得安靜。',
  '{tribe} 撿到一片紅色葉子,開心地抱住。',
  '島邊的池塘今天結了第一片冰。',
  '{tribe} 在屋簷下發現一個小小腳印。',
  '一群小精靈圍在一起看一顆石頭。',
  '{tribe} 把一朵花別在頭上。',
  '海風吹過,所有的草都往同一邊倒。',
  '島中央那棵樹搖了搖,落下一顆果子。',
  '{tribe} 看著海發呆。',
  '一隻蝴蝶飛過島嶼,沒有停下。',
  '雲飄過去,陽光照在草地上。',
  '{tribe} 學會了揮手。',
  '島邊有人放了一個寄居蟹,或是寄居蟹自己來的。',
  '今天的雲長得像兔子。',
  '{tribe} 把石頭推到另一邊,又推回來。',
  '一陣風把信吹走了,又吹回來。',
  '{tribe} 在沙灘上畫了一個圓。',
  '今天的夕陽特別紅。',
  '海面上閃了一下,可能是魚。',
  '{tribe} 跟另一隻小精靈點頭打招呼。',
  '島上多了一片青苔。',
] as const;

/**
 * 隨機選一個事件腳本,inject tribe name。
 * 用 deterministic seed(基於日期 + tribe)避免重複 render 換腳本造成閃爍。
 */
export function pickRandomEvent(tribe: string, seed?: number): string {
  const events = PIKMIN_RANDOM_EVENTS;
  const idx = seedToIndex(seed ?? Date.now(), events.length);
  const template = events[idx];
  return template.replace(/\{tribe\}/g, tribe || '小苗');
}

/**
 * 第一隻 pikmin 孵化後的歡迎句(取代「{tribe} 還在睡」的初始狀態)。
 */
export function pikminHatchedGreeting(tribe: string, pikmin: Pikmin): string {
  const colorWord: Record<typeof pikmin.color, string> = {
    green: '綠色的',
    violet: '紫色的',
    orange: '橙色的',
    cyan: '藍色的',
    grey: '灰色的',
  };
  return `第一隻 ${colorWord[pikmin.color]} ${tribe} 來了。`;
}

/**
 * Stable hash → index。用於 SSR / hydration 一致性,避免 client/server 隨機數不同造成 mismatch。
 */
function seedToIndex(seed: number, len: number): number {
  // 簡單 LCG 變異:把 seed 收斂到 [0, len) 範圍
  const x = Math.abs(Math.imul(seed | 0, 2654435761) >>> 0);
  return x % len;
}
