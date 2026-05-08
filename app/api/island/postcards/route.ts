/**
 * /api/island/postcards — postcard list 讀取 + 標已讀。
 *
 * GET: 回所有 postcards(已 reverse-chronological,新的在前)
 * PATCH: { ids: string[] } → 標 readAt
 */

import { z } from 'zod';
import { errorResponse, okResponse, requireAuth } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/feature-flags';
import { islandPostcardsKey, parseRedisJson, redis } from '@/lib/redis';
import type { Postcard } from '@/lib/island-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function ensureFlagOn(): Response | null {
  if (!FEATURES.island) {
    return errorResponse(404, 'not_found', '找不到此資源');
  }
  return null;
}

const PatchBodySchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
});

/* ============================================================
   GET — list postcards(reverse-chronological)
   ============================================================ */
export async function GET() {
  const flagBlock = ensureFlagOn();
  if (flagBlock) return flagBlock;

  const session = await requireAuth();
  if (!session.ok) return session.response;

  const raw = await redis.get<unknown>(islandPostcardsKey(session.email));
  const list = parseRedisJson<Postcard[]>(raw) ?? [];

  // server 寫入是時間順序,讀取 reverse(新在前)讓信箱頁直接 render
  const reversed = [...list].reverse();
  return okResponse({ postcards: reversed });
}

/* ============================================================
   PATCH — 標已讀(批次)
   ============================================================ */
export async function PATCH(req: Request) {
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

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, 'invalid_body', 'ids 格式錯誤', {
      issues: parsed.error.issues,
    });
  }

  const key = islandPostcardsKey(session.email);
  const raw = await redis.get<unknown>(key);
  const list = parseRedisJson<Postcard[]>(raw) ?? [];

  const idSet = new Set(parsed.data.ids);
  const nowIso = new Date().toISOString();
  let mutated = false;
  const updated = list.map((p) => {
    if (idSet.has(p.id) && p.readAt === null) {
      mutated = true;
      return { ...p, readAt: nowIso };
    }
    return p;
  });

  if (mutated) {
    await redis.set(key, JSON.stringify(updated));
  }

  return okResponse({ updated: mutated });
}
