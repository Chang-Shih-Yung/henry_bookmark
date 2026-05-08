/**
 * 月扣明信片模板信(GDD §32.14、Phase 3)。
 *
 * 16 種 fallback:12 個月度 + 4 個季節 / 節日。Claude API mode 也用這些當 5 秒
 * timeout fallback,所以無論付費與否都一定要建好。
 *
 * 風格規則(GDD §16):
 * - Animal Crossing 角色說話,清新可愛、不嚴肅
 * - 動植物動詞優先(發芽、開花、結霜、融雪、飄落)
 * - 80-120 字
 * - 不寫指責 / 不情勒 / 不焦慮
 * - 不解釋規則,只描寫畫面
 *
 * 變數注入:
 *   {tribe} = 玩家給的族名(預設「小苗」)
 *   {month} = 1-12 數字
 *   {season} = 春 / 夏 / 秋 / 冬
 *
 * 為什麼分成 monthly + seasonal:
 * - monthly 12 個確保「每個月開信都有合適的氣氛詞」
 * - seasonal/festival 4 個是 stretch — 跨年、清明、中秋、聖誕等特殊月會優先用
 */

import type { Pikmin } from './island-types';

/* ============================================================
   Context — 模板渲染時注入的變數
   ============================================================ */
export type PostcardContext = {
  tribe: string;           // 族名
  monthYYYYMM: string;     // "2026-05"
  /** 該月主要 pikmin 顏色(Phase 5+ 多隻時取最近一隻 / Phase 2 取唯一一隻) */
  dominantColor: Pikmin['color'];
};

/* ============================================================
   12 種月度模板(每個月一首)
   index 0 = January
   ============================================================ */
const MONTHLY_TEMPLATES: ReadonlyArray<string> = [
  // 1 月 — 冷、年初、安靜
  '親愛的未來的我:\n一月的島上有點冷。{tribe} 躲在屋簷下擠成一團。\n這個月我們又種了一棵樹,土裡冒出三顆種子。\n春天還沒來,但我們會等到。\n                       現在的我',
  // 2 月 — 等待、寒末
  '親愛的未來的我:\n二月的島上,風還是涼的。\n{tribe} 在沙灘上撿了一顆石頭,放在屋簷下排第二顆。\n聽說春天快到了。\n                       現在的我',
  // 3 月 — 春初、第一片綠芽
  '親愛的未來的我:\n三月,土裡冒出了第一片綠芽。\n{tribe} 蹲在芽旁邊看了好久,然後跑去叫朋友來看。\n小小的、軟軟的。\n                       現在的我',
  // 4 月 — 春雨
  '親愛的未來的我:\n四月下了一場春雨,把整座島洗得很乾淨。\n{tribe} 在水窪旁邊跳來跳去,踩出小小的腳印。\n樹葉變得更綠了。\n                       現在的我',
  // 5 月 — 花開
  '親愛的未來的我:\n五月的島上開了第一朵花。\n{tribe} 把花別在頭上,走來走去給每隻朋友看。\n他們也想要,但只有一朵。\n                       現在的我',
  // 6 月 — 夏初、長日
  '親愛的未來的我:\n六月的太陽變大了。\n{tribe} 學會了找陰涼處睡午覺。她在那棵最高的樹下打了 兩個哈欠,然後睡著了。\n                       現在的我',
  // 7 月 — 海邊
  '親愛的未來的我:\n七月,海水變得溫溫的。\n{tribe} 第一次走到海邊,踩了水又跳回來,溼了一半。\n她看了海好久。\n                       現在的我',
  // 8 月 — 雷雨、生長
  '親愛的未來的我:\n八月來了一場雷雨,所有的草都長高了一點點。\n{tribe} 躲在傘下,雨停後她去外面轉了一圈,然後又躲回去。\n                       現在的我',
  // 9 月 — 秋初、葉變色
  '親愛的未來的我:\n九月,有一片葉子變紅了。\n{tribe} 撿到那片葉子,認真地把它放在自己頭上。\n她說那是帽子。\n                       現在的我',
  // 10 月 — 秋深、紅葉雨
  '親愛的未來的我:\n十月的島下了一場紅葉雨。\n{tribe} 在葉子堆裡跳來跳去,跳累了就坐下來看。\n風吹過,葉子又飛起來。\n                       現在的我',
  // 11 月 — 冬初
  '親愛的未來的我:\n十一月的早晨開始有霜。\n{tribe} 對著草地呼了一口氣,看著霧散開。\n她覺得很有趣,又呼了一口。\n                       現在的我',
  // 12 月 — 跨年前夕
  '親愛的未來的我:\n十二月,池塘結了第一片冰。\n{tribe} 用腳輕輕踩了一下,冰沒破。\n她坐下來等下個月來。\n                       現在的我',
];

/* ============================================================
   4 種季節 / 節日模板(優先使用)
   ============================================================ */
const SEASONAL_TEMPLATES: Record<string, string> = {
  // 跨年(12 月最後一週、1 月第一週)
  newyear:
    '親愛的未來的我:\n跨年那天島上放了煙火。\n{tribe} 抬著頭看,沒眨眼。\n煙火停了之後,她坐在原地很久,沒說話。\n你那邊,新的一年好嗎?\n                       現在的我',
  // 春節 / 農曆新年(1-2 月浮動,我們用 2 月匹配)
  lunar:
    '親愛的未來的我:\n島上掛起了紅色的小燈籠。\n{tribe} 第一次看到紅色,看了好久。\n風吹過,燈籠晃啊晃,她跟著晃。\n                       現在的我',
  // 中秋(9-10 月)
  midautumn:
    '親愛的未來的我:\n今晚的月亮特別大。\n{tribe} 跟朋友坐在草地上仰著看,沒人說話。\n月光把島照得藍藍的。\n                       現在的我',
  // 聖誕(12 月)
  christmas:
    '親愛的未來的我:\n島上下了一點點雪。\n{tribe} 在雪裡走出小小的腳印,然後又走回來把它踩平。\n她說這樣才公平。\n                       現在的我',
};

/* ============================================================
   主函式 — 根據月份回傳模板信
   ============================================================ */
export function getPostcardTemplate(ctx: PostcardContext): string {
  const month = parseMonth(ctx.monthYYYYMM);
  if (month < 1 || month > 12) {
    // 壞 month 字串保險:回 1 月模板
    return inject(MONTHLY_TEMPLATES[0], ctx);
  }

  // 季節 / 節日優先(若該月份有對應節日)
  const seasonal = pickSeasonalForMonth(month);
  const template = seasonal ?? MONTHLY_TEMPLATES[month - 1];
  return inject(template, ctx);
}

/**
 * 列出所有模板鍵(test / 預覽用)
 */
export function listAllTemplates(): Array<{ key: string; preview: string }> {
  const ctx: PostcardContext = {
    tribe: '小苗',
    monthYYYYMM: '2026-05',
    dominantColor: 'green',
  };
  const monthly = MONTHLY_TEMPLATES.map((t, i) => ({
    key: `monthly-${i + 1}`,
    preview: inject(t, { ...ctx, monthYYYYMM: `2026-${String(i + 1).padStart(2, '0')}` }),
  }));
  const seasonal = Object.entries(SEASONAL_TEMPLATES).map(([key, t]) => ({
    key: `seasonal-${key}`,
    preview: inject(t, ctx),
  }));
  return [...monthly, ...seasonal];
}

/* ============================================================
   Helpers
   ============================================================ */
function parseMonth(yyyymm: string): number {
  const m = yyyymm.match(/^\d{4}-(\d{2})$/);
  if (!m) return 0;
  return parseInt(m[1], 10);
}

/**
 * 哪個月份有節日模板?(回 null 表示走一般月度)
 * Phase 3 minimal:每個季節只指派一個固定月份觸發,Phase 7 季節活動展開後
 * 改成 query 既有 seasonal-events 系統。
 */
function pickSeasonalForMonth(month: number): string | null {
  // 跨年:12 月優先 newyear(雖然 12 月也是聖誕,但每月只能挑一張)
  // 為了 Phase 3 minimal 不複雜化,簡單分配:
  if (month === 12) return SEASONAL_TEMPLATES.newyear;
  if (month === 2) return SEASONAL_TEMPLATES.lunar;
  if (month === 9) return SEASONAL_TEMPLATES.midautumn;
  // 其他月份用一般月度模板
  return null;
}

function inject(template: string, ctx: PostcardContext): string {
  const month = parseMonth(ctx.monthYYYYMM);
  const season = monthToSeason(month);
  return template
    .replace(/\{tribe\}/g, ctx.tribe || '小苗')
    .replace(/\{month\}/g, String(month))
    .replace(/\{season\}/g, season);
}

function monthToSeason(month: number): string {
  if (month >= 3 && month <= 5) return '春';
  if (month >= 6 && month <= 8) return '夏';
  if (month >= 9 && month <= 11) return '秋';
  return '冬';
}
