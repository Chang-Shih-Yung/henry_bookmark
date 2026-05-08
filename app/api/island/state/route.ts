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
import { islandStateKey, parseRedisJson, redis } from '@/lib/redis';
import {
  defaultIslandState,
  mergeIslandState,
  type IslandState,
} from '@/lib/island-types';

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
   GET — 讀 state
   ============================================================ */
export async function GET() {
  const flagBlock = ensureFlagOn();
  if (flagBlock) return flagBlock;

  const session = await requireAuth();
  if (!session.ok) return session.response;

  const key = islandStateKey(session.email);
  const raw = await redis.get<unknown>(key);
  const stored = parseRedisJson<IslandState>(raw);

  // 沒紀錄 → 回 default(不寫,等第一次 patch 才落地)
  const state = stored ?? defaultIslandState();

  return okResponse({ state });
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
