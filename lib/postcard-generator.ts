/**
 * Postcard generator — 月扣明信片生成入口(Phase 3)。
 *
 * 設計(GDD §32.8 + §32.14):
 * - **template-mode**(預設):無 ANTHROPIC_API_KEY 時走這條,直接從 16 種模板
 *   抽一張 + inject {tribe} 變數
 * - **claude-mode**(未來):有 ANTHROPIC_API_KEY 時走 streamText API,5 秒
 *   timeout fallback 回模板
 *
 * Idempotency(防雙寫):
 * - Redis lock key `island:idem:postcard:${email}:${YYYY-MM}` 寫入時檢查
 * - 多月補單時逐月檢查 lock
 *
 * Storage:
 * - postcards 寫入 `island:postcards:${email}` list,append-only,reverse-chronological
 *   讀取(最新在前)
 *
 * 為什麼 server-side 模式偵測:client 不需要知道 backend 用模板還 Claude,
 * 反正 typewriter UI 都會跑(claude-mode 串流 / template-mode 用 local timer)。
 */

import {
  islandPostcardLockKey,
  islandPostcardsKey,
  parseRedisJson,
  redis,
} from './redis';
import {
  getPostcardTemplate,
  type PostcardContext,
} from './postcard-templates';
import type { Postcard } from './island-types';

/* ============================================================
   模式偵測 — 純依 env var,沒設就走模板
   ============================================================ */
export type PostcardMode = 'template' | 'claude';

export function getPostcardMode(): PostcardMode {
  return process.env.ANTHROPIC_API_KEY ? 'claude' : 'template';
}

/* ============================================================
   生成單張 postcard(template mode 同步,claude mode Phase 4 加上)
   ============================================================ */
export function generateTemplatePostcard(
  ctx: PostcardContext,
): Pick<Postcard, 'body' | 'source'> {
  return {
    body: getPostcardTemplate(ctx),
    source: 'template',
  };
}

/* ============================================================
   批量生成 + 寫入 Redis(idempotent,可重複呼叫)

   被 state route 在 monthly trigger 時呼叫,把 monthsTriggered 全部處理
   ============================================================ */
export type GeneratedPostcardsResult = {
  newPostcards: Postcard[];        // 本次新生成的(沒被 idempotency lock 擋的)
  newPostcardIds: string[];
};

export async function generatePostcardsForMonths(
  email: string,
  months: string[],
  ctx: Omit<PostcardContext, 'monthYYYYMM'>,
): Promise<GeneratedPostcardsResult> {
  if (months.length === 0) return { newPostcards: [], newPostcardIds: [] };

  // 讀現有 postcards
  const rawList = await redis.get<unknown>(islandPostcardsKey(email));
  const existingList = parseRedisJson<Postcard[]>(rawList) ?? [];
  const existingIds = new Set(existingList.map((p) => p.id));

  const newPostcards: Postcard[] = [];

  for (const month of months) {
    // Idempotency check — 同月已 lock 就 skip(防 race / 多裝置雙寫)
    const lockKey = islandPostcardLockKey(email, month);
    const lockExists = await redis.get<unknown>(lockKey);
    if (lockExists) continue;

    // 生成 + 加進 list
    const template = generateTemplatePostcard({ ...ctx, monthYYYYMM: month });
    const postcard: Postcard = {
      id: cryptoRandomId(),
      monthYYYYMM: month,
      body: template.body,
      createdAt: new Date().toISOString(),
      source: template.source,
      readAt: null,
    };

    // 防意外重複(同 ID 不該發生但保險)
    if (existingIds.has(postcard.id)) continue;
    newPostcards.push(postcard);

    // 寫 lock(60 天 TTL,涵蓋玩家可能跨月晚開的情境)
    await redis.set(lockKey, '1', { ex: 60 * 60 * 24 * 60 });
  }

  if (newPostcards.length > 0) {
    // 新的接到舊的後面(時間順序),寫回
    const merged = [...existingList, ...newPostcards];
    await redis.set(islandPostcardsKey(email), JSON.stringify(merged));
  }

  return {
    newPostcards,
    newPostcardIds: newPostcards.map((p) => p.id),
  };
}

/* ============================================================
   Helpers
   ============================================================ */
function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
