# Design System — henry_bookmark

> 投資追蹤 PWA 加 Pikmin Bloom 風格遊戲層的視覺真相來源。
>
> 完整 GDD 在 `~/.gstack/projects/Chang-Shih-Yung-henry_bookmark/itts-claude-unruffled-engelbart-1c380a-design-20260508-111212.md`,本文件是實作 reference 摘要。

---

## Product Context

- **What this is:** 個人投資追蹤 PWA(V1)加 Pikmin Bloom 風格生活遊戲層(Phase 1-12)
- **Who it's for:** Henry 個人(25-40 歲、上班族、定期定額投資人)+ 未來潛在朋友
- **Space:** 個人理財 / 生活遊戲混合品類(沒有真正競品,Pikmin Bloom 是調性 reference,不是功能 reference)
- **Project type:** Mobile-first PWA(iPhone 為主,iPad / Desktop 居中縮放)
- **Memorable thing:** 「**錢從抽象變成有機物,你看著自己的選擇長出森林。**」每個設計決策都服務這句。

## Visual Thesis

> **「呼吸的島嶼」** — 動植物有機生長 + 月相節奏 + 紙質溫度。
>
> 介面像活著一樣呼吸,但每一次呼吸都很慢、很輕。

## Aesthetic Direction

- **Direction:** Organic Cozy + Editorial(主)+ 手繪 paper texture(配)
- **Decoration level:** Intentional(中等 — 不 minimal、不 expressive)
- **Mood:** 像看別人的島,而不是「使用 app」。慢、輕、不催促。
- **Reference:**
  - Pikmin Bloom(美術 + 互動節奏 + 朋友功能)
  - Animal Crossing: Pocket Camp(島嶼物件感)
  - Cozy Grove(信件 / 故事節拍)
  - Niantic Wayfarer(地圖 / 世界感)
- **Anti-reference:** Pokemon battle、Diablo、Final Fantasy、SaaS dashboard、所有 RPG 寶箱風

### Anti-slop blacklist(禁忌)

- ❌ 紫色 / violet 漸層底色(雖 V1 brand 是 violet,但 island 不能整片紫漸層)
- ❌ 3-column feature grid(SaaS template look)
- ❌ Centered everything(text-align: center 全用)
- ❌ 統一 bubble border-radius
- ❌ 金光、發光升級框、寶箱開啟動畫
- ❌ system-ui / `-apple-system` 當主字體
- ❌ Generic stock-photo hero
- ❌ Inter / Roboto / Montserrat / Space Grotesk(收斂陷阱)

---

## Typography

V1 既有 + 新增 serif 給 postcard 信件(僅一處)。

| 角色 | 字體 | 用途 | 載入策略 |
|---|---|---|---|
| Display | `font-display`(V1 既有)| Toast、戳章名字、儀式標題、目標達成歡呼、明信片標題 | V1 已 self-host |
| Body | `font-body`(V1 既有)| 設定頁、互動 UI、提示文字、tab label | V1 已 self-host |
| Numerals | `tabular-nums` modifier | 連續紀錄、目標 %、月份、年齡 | CSS modifier |
| **Postcard 信文(🆕)** | **Noto Serif TC**(serif) | 月扣信、目標達成信、跨年回顧 | Google Fonts lazy-load,僅在 PostcardRitual 動態載入 |
| Code(僅 dev console)| 系統 mono fallback | 不在 user-facing UI | n/a |

**Scale(reuse V1 + 新增 ritual size):**

| Token | px | rem | 用途 |
|---|---|---|---|
| `text-[10px]` | 10 | 0.625 | label / sub-text |
| `text-xs` | 12 | 0.75 | metadata |
| `text-sm` | 14 | 0.875 | secondary |
| `text-base` | 16 | 1 | body |
| `text-lg` | 18 | 1.125 | section heading |
| `text-xl` | 20 | 1.25 | page heading |
| `text-2xl` | 24 | 1.5 | hero |
| `text-postcard` | 16 | 1 | postcard 信文(行距 1.6) |
| `text-ritual` | 28 | 1.75 | 儀式級標題(月扣 / 跨年 / 目標達成) |

---

## Color

延續 V1 既有 oklch 系統 + 新增遊戲層 namespace。**永遠用 oklch,永遠用 CSS 變數。**

### V1 既有(不動)

```css
--background: oklch(0.145 0 0);
--foreground: oklch(0.985 0 0);
--brand-violet: oklch(0.65 0.22 270);
--accent-brand: oklch(0.7 0.18 285);
--muted-foreground: oklch(0.708 0 0);
--border: oklch(1 0 0 / 0.1);
--popover-bg: oklch(0.205 0 0);
--card: oklch(0.205 0 0);
```

### 遊戲層自然色票(🆕)

```css
/* 地形 */
--island-grass: oklch(0.78 0.14 145);
--island-grass-dark: oklch(0.62 0.16 150);
--island-soil: oklch(0.58 0.10 60);
--island-sand: oklch(0.85 0.08 80);
--island-stone: oklch(0.65 0.02 60);

/* 水 */
--island-water: oklch(0.72 0.14 220);
--island-water-deep: oklch(0.55 0.16 230);

/* 天空(時段) */
--island-sky-day: oklch(0.88 0.06 220);
--island-sky-dusk: oklch(0.75 0.12 30);
--island-sky-night: oklch(0.30 0.10 270);

/* 紙質 */
--island-paper: oklch(0.94 0.04 80);       /* 信紙米白 */
--island-paper-edge: oklch(0.78 0.06 60);   /* 折痕 */
```

### 季節 overlay(🆕)

整片島嶼的色調漸變,不是粒子覆蓋。

```css
--season-spring: oklch(0.92 0.08 350 / 0.15);  /* 粉色 */
--season-summer: oklch(0.95 0.10 200 / 0.10);  /* 偏藍 */
--season-autumn: oklch(0.78 0.18 50 / 0.18);   /* 紅金 */
--season-winter: oklch(0.92 0.04 220 / 0.15);  /* 冷白 */
```

### 小精靈五色(🆕,對應投資組合)

**這是產品獨特標誌 — 不要改。**

```css
--pikmin-green: oklch(0.72 0.18 145);   /* 台股 */
--pikmin-violet: oklch(0.65 0.22 285);  /* 美股 = brand-violet */
--pikmin-orange: oklch(0.75 0.20 60);   /* 加密 */
--pikmin-cyan: oklch(0.78 0.18 195);    /* 現金 */
--pikmin-grey: oklch(0.70 0.02 0);      /* 信託 */
```

組合占比 > 30% 該顏色小精靈在島上比較多;> 50% 下一代基因更明顯。

### 語義色(reuse V1)

V1 用 violet brand 做 primary action、用 muted 做 secondary。Island layer 沿用,不引入新的 success / warning / error,因為遊戲層**不該有 alert UX**(看 Anti-slop 列表)。

### Dark mode

V1 已是 dark-only(`background: oklch(0.145 0 0)`)。Island 層繼承 dark base,但島嶼本身亮(white-ish island on dark sky background),產生「夜空中的小島」視覺。**不做 light mode**。

---

## Spacing

完全 reuse V1 + Tailwind v4 預設。

- **Base unit:** 4px
- **Density:** Comfortable(同 V1)
- **Scale(Tailwind 預設):** 1(4) 2(8) 3(12) 4(16) 6(24) 8(32) 12(48) 16(64)
- **Island 內元件間距更鬆:** `gap-8`、`p-6`,營造「呼吸感」

---

## Layout

- **Approach:** Hybrid
  - **App 部分(`/`、`/holding`、`/simulate`、`/settings`)** — Grid-disciplined,延續 V1 慣例
  - **Island 部分(`/island/*`)** — Creative,不規則布局
- **Container:** `max-w-2xl mx-auto p-4`(V1 既有 mobile 慣例)
- **Mobile breakpoints:** 375px(iPhone SE)/ 390px / 430px(iPhone Pro Max)/ 744px(iPad)
- **Desktop:** 同 mobile 居中,不重排版

### Border radius hierarchy

| Token | 值 | 用途 |
|---|---|---|
| `rounded-sm` | 4px | 小 chip / badge |
| `rounded-md` | 6px | input / button |
| `rounded-lg` | 8px | card / drawer item |
| `rounded-xl` | 12px | section card |
| `rounded-2xl` | 16px | drawer / modal(reuse V1) |
| **deckle edge SVG mask** | — | **信紙 / 明信片**(不用 border-radius) |
| **無 radius** | — | **戳章**(不規則 SVG 線稿) |

---

## Motion

- **Library:** `framer-motion@12.38`(V1 deps,**不增加 bundle**)
- **Reduced motion:** Root `<MotionConfig reducedMotion="user">`,iOS 設定有 prefers-reduced-motion 自動降級
- **Approach:** Intentional

### Easing

```ts
export const ISLAND_EASE = {
  enter: [0, 0, 0.2, 1],          // easeOut, 像花瓣落下
  exit: [0.4, 0, 1, 1],           // easeIn, 像吸入
  move: [0.4, 0, 0.2, 1],         // easeInOut, mascot 散步
  spring: { type: 'spring', stiffness: 300, damping: 30 },  // 蛋孵化、戳章
};
```

### Duration tier

| Tier | Duration | 用途 |
|---|---|---|
| `instant` | 100-200ms | toast、按鈕 hover、scale-[0.97] |
| `short` | 300ms | crossfade、信紙翻頁、頁面切換 |
| `medium` | 600-800ms | 蛋裂開、樹開花單次、戳章彈跳 |
| `ritual` | 5-30s | 月扣信、跨年、目標達成(§22 hard cap 8s 第二次起) |

### 動畫禁忌(reuse GDD §21)

- ❌ 金光閃閃
- ❌ 數字 +XP 彈跳
- ❌ 戰鬥音效
- ❌ 寶箱開啟
- ❌ 升級邊框

### Tailwind for trivial

`active:scale-[0.97]`、`animate-in fade-in-0`、`transition-colors` 等瞬間動畫直接用 Tailwind,不啟動 framer-motion render cycle。

---

## Iconography

- **Library:** `lucide-react`(V1 deps)— stroke-2,線稿風
- **Custom SVG:** Mascot、小精靈、戳章、樹、房子、季節物件 — 全部走 SVG component(不用 icon font)
- **Bottom nav icons:** Lucide(home / chart-bar / circle / settings / user-round)+ island 用客製 SVG

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-08 | 平台 = PWA + Phase 9 後評估 Capacitor | 設計核心 9 成 PWA 可跑、V1 100% 重用、4 個月可 ship MVP |
| 2026-05-08 | 隔離策略 = 同 repo + feature flag | V1 main 分支 production 純 V1、scrap path 簡潔、shared infra 維護成本最低 |
| 2026-05-08 | 美術風格 = Vector Flat 2D Top-Down | Pikmin Bloom 本人風格、組合 V1 brand violet 自然、最易做 mockup |
| 2026-05-08 | 字體 = font-display + font-body + Noto Serif TC | reuse V1 brand identity,僅明信片新增 serif 區隔 |
| 2026-05-08 | 色票 = oklch 延伸 V1 + 5 色小精靈對應投資組合 | 投資組合視覺化是產品獨特標誌(Pikmin Bloom 沒做) |
| 2026-05-08 | 動畫 = framer-motion 統一 + Tailwind for trivial | 既有 dep 不加 bundle,reduced-motion 全自動 |
| 2026-05-08 | 月扣 trigger = lazy on next-open(不用 cron)| 沒 timezone / 推播失敗等問題,server idempotency lock |
| 2026-05-08 | Service Worker 不動 | V1 push-only sw.js 故意極簡,離線靠 localStorage + TanStack Query |
| 2026-05-08 | Feature flag = NEXT_PUBLIC_ISLAND_ENABLED | production 預設 false,自己 dev / preview 可 true |

---

## Implementation References

- 完整遊戲設計藍圖(GDD): `~/.gstack/projects/Chang-Shih-Yung-henry_bookmark/itts-claude-unruffled-engelbart-1c380a-design-20260508-111212.md`
- 互動狀態矩陣: GDD §12.5
- 反 AI slop 細項: GDD §21.5
- 情緒弧線缺口: GDD §23.5
- 響應式 + a11y: GDD §32.6
- Redis schema: GDD §32.7
- Claude API 整合: GDD §32.8
- Phase 1 開工 checklist: GDD §32.13
- Phase 3 開工 checklist: GDD §32.14
