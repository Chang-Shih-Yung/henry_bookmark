<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git workflow:NEVER create PRs

**這個專案禁止發 PR。** 直接推到 branch / main,沒有 review cycle。

具體規則:
- ❌ 永遠不要呼叫 `gh pr create`
- ❌ 永遠不要在 commit message 提「ready for review」「please review」
- ❌ 永遠不要建議跑 `/ship` / `/land-and-deploy` 這種會觸發 PR 流程的 skill
- ✅ 直接 `git commit` + `git push origin <branch>`
- ✅ Henry 自己控制 main 的 promotion(branch → main)透過 local merge 或 Vercel env var flip,不走 PR

理由:Henry 是 solo developer,PR review 對 solo 是過度流程。歷史 PR #1 是早期 fallback,已封存,不再走那套。

如果你跑 skill 提示「want to ship via /ship」或類似,**回應「Henry 拒絕 PR 流程,直接 push」即可**。

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.

All font choices, colors (oklch values), spacing, motion timings, and aesthetic direction are defined there. Do not deviate without explicit user approval.

Key constraints summary(完整見 `DESIGN.md`):
- Aesthetic: Organic Cozy + Editorial(Pikmin Bloom 風),禁 RPG / SaaS template / system-ui
- Font: `font-display` + `font-body`(V1 既有)+ Noto Serif TC(僅 postcard 信文 lazy-load)
- Color: oklch 系統,5 色小精靈對應投資組合(綠台股 / 紫美股 / 橙加密 / cyan 現金 / 灰信託)
- Motion: framer-motion 統一,`<MotionConfig reducedMotion="user">` 全自動降級
- Anti-slop: 不用紫漸層底、不用 3-column feature grid、不用金光升級框、不用 system-ui

In QA mode, flag any code that doesn't match `DESIGN.md`.

## Game Layer Isolation(Phase 1-12)

Game layer 100% 住在獨立命名空間,V1 程式碼**一行都不改**:
- `app/island/*`、`app/api/island/*`(routes)
- `components/island/*`(UI)
- `lib/island-*.ts`、`lib/animations.ts`、`lib/postcard-templates.ts`、`lib/streak-calc.ts`、`lib/feature-flags.ts`(util)

Feature flag `NEXT_PUBLIC_ISLAND_ENABLED` 控制是否顯示。Production 預設 `false`(main 分支看不到 island),feature 分支 / dev 預設 `true`。

完整 GDD: `~/.gstack/projects/Chang-Shih-Yung-henry_bookmark/itts-claude-unruffled-engelbart-1c380a-design-20260508-111212.md`
