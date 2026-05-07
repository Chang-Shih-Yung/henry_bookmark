/**
 * 集中所有 JS / Chart.js 用到的 oklch 色值,跟 globals.css 的 CSS variable 同步。
 * Chart.js callback 不容易讀 CSS var,只好在這裡放常數。
 *
 * 換主題色時改這裡 + globals.css 的 --accent-brand 即可,不要在元件裡 hardcode。
 */

// 品牌主色:藍紫(violet/indigo),跟 globals.css `--accent-brand` 同步
export const ACCENT_BRAND = 'oklch(0.68 0.22 280)';

/** 帶 alpha 的品牌色,給陰影 / fill / 半透明邊用。 */
export const accentBrandAlpha = (a: number): string =>
  `oklch(0.68 0.22 280 / ${a})`;

/** 漸層用兩端色:violet → indigo,給線條 stroke 漸層。 */
export const ACCENT_GRADIENT_FROM = 'oklch(0.62 0.2 270)';
export const ACCENT_GRADIENT_TO = 'oklch(0.7 0.22 290)';

/** 三段式情緒色(資產走勢:漲 / 平 / 跌)。 */
export const TREND_UP = 'oklch(0.7 0.22 280)'; // 藍紫(漲)
export const TREND_FLAT = 'oklch(0.95 0.02 280)'; // 接近白(平)
export const TREND_DOWN = 'oklch(0.74 0.16 50)'; // 淺橘紅(跌)

export const trendUpAlpha = (a: number) => `oklch(0.7 0.22 280 / ${a})`;
export const trendFlatAlpha = (a: number) => `oklch(0.95 0.02 280 / ${a})`;
export const trendDownAlpha = (a: number) => `oklch(0.74 0.16 50 / ${a})`;

/** 中性 popover bg。 */
export const POPOVER_BG = 'oklch(0.205 0 0 / 0.95)';
export const POPOVER_BORDER = (a: number) => `oklch(1 0 0 / ${a})`;

/** Foreground / muted text(rgb 用 oklch 直給最簡單)。 */
export const FOREGROUND = 'oklch(0.985 0 0)';
export const MUTED = 'oklch(0.708 0 0)';
