import { Redis } from '@upstash/redis';

/**
 * Upstash Redis client(取代 deprecated 的 @vercel/kv)。
 * Vercel Marketplace 加 Upstash Redis integration 後,以下 env vars 會自動注入:
 *   - UPSTASH_REDIS_REST_URL
 *   - UPSTASH_REDIS_REST_TOKEN
 *
 * 本機開發:在 .env.local 填入(從 Upstash console 拿)。
 */
export const redis = Redis.fromEnv();

export const holdingsKey = (email: string) => `holdings:${email.toLowerCase()}`;
