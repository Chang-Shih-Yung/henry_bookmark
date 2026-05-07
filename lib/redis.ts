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

/** Web Push 訂閱(每個 user 可同時有多個裝置 → set of subscription JSONs)。 */
export const pushSubscriptionsKey = (email: string) =>
  `push:subscriptions:${email.toLowerCase()}`;

/** 提醒設定(per user)。 */
export const reminderConfigKey = (email: string) =>
  `push:config:${email.toLowerCase()}`;

/** 全部啟用提醒的 user emails(cron 跑時 query 這個 set 知道要對誰發)。 */
export const enabledRemindersKey = () => 'push:enabled-emails';

/**
 * Upstash Redis 預設 `automaticDeserialization: true`,smembers 回的會已經被 JSON.parse 過。
 * 但寫入時用 `JSON.stringify(...)` 存的話,Upstash 在讀取時可能回 string 也可能回 object
 * (取決於是否能成功 parse)。這個 helper 把「string OR 已解 object」統一成 object。
 *
 * 之前 /api/push/test 跟 /api/push/subscribe DELETE 都直接 JSON.parse(rawObject)
 * → throw → catch continue → 整個 push 邏輯靜默失敗,sentCount 永遠 0。
 */
export function parseRedisJson<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw as T;
  return null;
}
