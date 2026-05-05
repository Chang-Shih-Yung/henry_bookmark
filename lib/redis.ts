import { Redis } from '@upstash/redis';

/**
 * Vercel Marketplace 的 Upstash integration 注入的是 KV_REST_API_* (legacy @vercel/kv naming),
 * 直接用 Upstash console 拿的話則是 UPSTASH_REDIS_REST_*。兩種都接受。
 */
const url =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  throw new Error(
    'Missing Upstash Redis credentials. Set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN (Upstash console) or KV_REST_API_URL/KV_REST_API_TOKEN (Vercel Upstash integration).',
  );
}

export const redis = new Redis({ url, token });

export const holdingsKey = (email: string) => `holdings:${email.toLowerCase()}`;
