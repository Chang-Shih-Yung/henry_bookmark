# Henry Bookmark

個人投資組合追蹤 + 長期資產試算。

- **總覽:** 大字總資產、進度條 → 1000 萬、資產分布圓餅圖
- **持有部位:** 台股 / 美股 / 加密貨幣 / 現金 / 信託,inline 編輯
- **即時價:** Yahoo Finance(股)+ CoinGecko(BTC/ETH/ADA)+ exchangerate-api(USD/TWD)
- **長期試算:** 從當前 holdings 出發跑 10 年,三情境(保守 / 中性 / 樂觀)
- **Auth:** Google OAuth + email 白名單(只有授權 email 能登入)
- **儲存:** Upstash Redis(跨裝置同步)

## Setup(Local Dev)

需求:Node 20+、pnpm 9+

```bash
pnpm install
cp .env.example .env.local
# 編輯 .env.local 填入 Google OAuth + Upstash Redis 的值
pnpm dev
```

開 http://localhost:3000 → 自動跳到 /login → 用 Google 登入。

### Google OAuth 申請

1. https://console.cloud.google.com/apis/credentials
2. Create credentials → OAuth client ID → **Web application**
3. Authorized redirect URIs 填:
   - `http://localhost:3000/api/auth/callback/google`(dev)
   - `https://你的網址.vercel.app/api/auth/callback/google`(prod,deploy 後加)
4. 拿到 Client ID + Secret 設進 `.env.local`

### NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

### Upstash Redis

- Vercel:Storage → Marketplace → Upstash Redis → 連到專案,env vars 自動注入
- Local dev:https://console.upstash.com/ 建一個免費 DB,複製 REST URL + Token 進 `.env.local`

## Deploy(Vercel)

1. push 到 GitHub
2. Vercel → New Project → 連 repo → Deploy
3. Vercel Dashboard → Settings → Environment Variables 填全部 7 個
4. Vercel Dashboard → Storage → 新增 Upstash Redis integration
5. 回 Google Cloud Console 把 production redirect URI 加上去
6. Trigger 一次 redeploy

## Tests

```bash
pnpm vitest run       # 跑一次
pnpm vitest           # watch 模式
```

18 個 vitest golden test 鎖死 `lib/calc.ts`(simulate / enrichHolding / applyBuy / applySell / computeSummary)。

## 架構

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + shadcn/ui (new-york) |
| State | React Query(staleTime 60s, refetchInterval 60s)|
| Charts | Chart.js + react-chartjs-2 |
| Storage | Upstash Redis(via @upstash/redis)|
| Auth | Auth.js v5 + Google Provider + email allowlist |
| Live prices | Edge route `/api/prices` proxy(避 CORS)|
| Tests | vitest + jsdom |
| Package manager | pnpm 9+ |

## 重要設計決策

- **Holdings 是 ground truth:** user 編輯 `units` + `costBasisTwd` 兩欄,市值/盈虧自動算
- **No transaction log:** 簡化模型,加買 = 直接累加 units + cost,賣出 = 用平均成本扣除
- **單頁 inline edit:** 主畫面 = 全部資產,點數字直接編,不分多頁
- **失敗模式:** 即時價 API 任一支壞掉,該欄位顯示「估算」徽章,其他正常
- **計算精度:** JS float,個人工具尺度可接受
- **不接幣安 API:** ETH/ADA 即時價走 CoinGecko,持有量 user 手動維護(免 API key)

完整設計文件:`~/.gstack/projects/nexus_handbook/itts-fubon-design-20260505-085029.md`
