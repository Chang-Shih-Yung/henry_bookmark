/**
 * /api/island/state — 遊戲層 mega-object 讀寫。
 *
 * GET: 讀整個 IslandState,沒紀錄 → 回 default(不寫,等第一次 patch)
 * POST: { patch: Partial<IslandState> } → deep-merge 寫回
 *
 * 設計原則(GDD §32.7、§32.13):
 * - parseRedisJson 必套(V1 學到的痛)
 * - mega-object 只一個 key:island:${email}
 * - schemaVersion 鎖在 IslandState 型別,migrate 時 bump
 * - Phase 2 會擴充 GET 加月扣 trigger 邏輯,Phase 1 先做純讀寫
 */

import { z } from 'zod';
import { errorResponse, okResponse, requireAuth } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/feature-flags';
import {
  holdingsKey,
  islandStateKey,
  parseRedisJson,
  redis,
} from '@/lib/redis';
import {
  defaultIslandState,
  mergeIslandState,
  type IslandState,
} from '@/lib/island-types';
import { applyMonthlyTrigger } from '@/lib/island-monthly';
import type { Holdings } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Defense-in-depth:flag OFF 時 API 也擋住,即使有人直接打路由也回 404。
 * UI 已經被 layout redirect 擋,這層是再保險。
 */
function ensureFlagOn(): Response | null {
  if (!FEATURES.island) {
    return errorResponse(404, 'not_found', '找不到此資源');
  }
  return null;
}

/* ============================================================
   Zod schemas — 只校驗 patch 的 top-level shape,inner 信任 type
   Phase 1 用 .passthrough() 寬鬆校驗,Phase 2 再嚴謹收斂
   ============================================================ */

const PatchSchema = z
  .object({
    profile: z.unknown().optional(),
    tracks: z.unknown().optional(),
    goals: z.array(z.unknown()).optional(),
    collections: z.unknown().optional(),
  })
  .passthrough();

const PostBodySchema = z.object({
  patch: PatchSchema,
});

/* ============================================================
   GET — 讀 state + 套用 monthly trigger(Phase 2)

   流程:
   1. 讀現有 state(沒就 default)
   2. 平行讀 V1 holdings(用來決定第一隻 pikmin 顏色)
   3. 套 applyMonthlyTrigger:同月 → noop,新月 → streak +1 + 可能孵化
   4. 若 trigger 不為 null → 寫回 state
   5. 回 { state, monthlyTrigger }
   ============================================================ */
export async function GET() {
  const flagBlock = ensureFlagOn();
  if (flagBlock) return flagBlock;

  const session = await requireAuth();
  if (!session.ok) return session.response;

  const stateKey = islandStateKey(session.email);
  const hKey = holdingsKey(session.email);

  // 平行讀 island state + holdings(holdings 只在第一次孵化時用,但 daily fetch 也 OK)
  const [rawState, rawHoldings] = await Promise.all([
    redis.get<unknown>(stateKey),
    redis.get<unknown>(hKey),
  ]);

  const stored = parseRedisJson<IslandState>(rawState);
  const holdings = parseRedisJson<Holdings>(rawHoldings);

  const current = stored ?? defaultIslandState();

  // 套 monthly trigger
  const nowIso = new Date().toISOString();
  const { nextState, trigger } = applyMonthlyTrigger(current, holdings, nowIso);

  // 只有 state 真的有變才寫回(避免每次 GET 都打 Redis write)
  const stateChanged = nextState !== current;
  if (stateChanged) {
    await redis.set(stateKey, JSON.stringify(nextState));
  }

  return okResponse({ state: nextState, monthlyTrigger: trigger });
}

/* ============================================================
   POST — patch state
   ============================================================ */
export async function POST(req: Request) {
  const flagBlock = ensureFlagOn();
  if (flagBlock) return flagBlock;

  const session = await requireAuth();
  if (!session.ok) return session.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'invalid_body', '請求格式錯誤');
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      'invalid_body',
      'patch 格式錯誤',
      { issues: parsed.error.issues },
    );
  }

  const key = islandStateKey(session.email);
  const raw = await redis.get<unknown>(key);
  const current = parseRedisJson<IslandState>(raw) ?? defaultIslandState();

  const next = mergeIslandState(current, parsed.data.patch as Partial<IslandState>);

  // 寫回:用 JSON.stringify 確保跨 Upstash auto-deserialize 行為一致
  await redis.set(key, JSON.stringify(next));

  return okResponse({ state: next });
}
