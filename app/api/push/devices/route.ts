import { requireAuth } from '@/lib/api-helpers';
import {
  parseRedisJson,
  pushSubscriptionsKey,
  redis,
} from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 列出當前 user 所有訂閱裝置(diagnostic 用)。
 * 回每台:provider / host / hash / endpoint / userAgent / subscribedAt。
 *
 * 兼容兩種儲存格式:
 *   舊:bare subscription { endpoint, expirationTime, keys }
 *   新:wrapped { subscription, userAgent, subscribedAt }
 * 舊資料 userAgent / subscribedAt 為 undefined,UI fallback「未知時間 / 未知裝置」
 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const subs = await redis.smembers(pushSubscriptionsKey(auth.email));
  const devices = subs
    .map((raw) => {
      const parsed = parseRedisJson<RawEntry>(raw);
      if (!parsed) return null;
      // 兩種 shape 都接受
      const subscription = parsed.subscription ?? (parsed as { endpoint?: string });
      if (!subscription?.endpoint) return null;
      try {
        const url = new URL(subscription.endpoint);
        return {
          provider: hostToProvider(url.host),
          host: url.host,
          hash: subscription.endpoint.slice(-12),
          endpoint: subscription.endpoint,
          userAgent: parsed.userAgent,
          subscribedAt: parsed.subscribedAt,
          // 把 UA 轉「人話 OS / 瀏覽器」摘要 — Henry 想分辨「哪一台」
          label: parsed.userAgent ? summarizeUserAgent(parsed.userAgent) : undefined,
        };
      } catch {
        return null;
      }
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  return Response.json({ count: devices.length, devices });
}

type RawEntry = {
  endpoint?: string;
  subscription?: { endpoint?: string };
  userAgent?: string;
  subscribedAt?: number;
};

/** 把 push service host 對應到人話 provider 名 */
function hostToProvider(host: string): string {
  if (host.includes('apple.com') || host.includes('push.apple'))
    return 'iOS / macOS';
  if (host.includes('fcm.google') || host.includes('android.google'))
    return 'Chrome / Android';
  if (host.includes('mozilla')) return 'Firefox';
  if (host.includes('windows')) return 'Edge / Windows';
  return host;
}

/**
 * UA 字串擷取 OS + 瀏覽器 + 機型(if iOS PWA),例:
 *  "iPhone · Safari 17"
 *  "iPad · Safari 17"
 *  "Mac · Safari 17"
 *  "Android · Chrome 120"
 */
function summarizeUserAgent(ua: string): string {
  // OS / 機型
  let device = '';
  if (/iPhone/.test(ua)) device = 'iPhone';
  else if (/iPad/.test(ua)) device = 'iPad';
  else if (/Macintosh/.test(ua)) device = 'Mac';
  else if (/Android/.test(ua)) {
    const m = ua.match(/Android [\d.]+; ([^;)]+)/);
    device = m ? m[1].trim() : 'Android';
  } else if (/Windows/.test(ua)) device = 'Windows';
  else device = '未知裝置';

  // 瀏覽器
  let browser = '';
  if (/CriOS\/(\d+)/.test(ua)) {
    const v = ua.match(/CriOS\/(\d+)/);
    browser = `Chrome ${v?.[1] ?? ''}`;
  } else if (/EdgiOS\/(\d+)/.test(ua)) {
    browser = 'Edge';
  } else if (/Edg\/(\d+)/.test(ua)) {
    const v = ua.match(/Edg\/(\d+)/);
    browser = `Edge ${v?.[1] ?? ''}`;
  } else if (/Firefox\/(\d+)/.test(ua)) {
    const v = ua.match(/Firefox\/(\d+)/);
    browser = `Firefox ${v?.[1] ?? ''}`;
  } else if (/Chrome\/(\d+)/.test(ua) && !/Edg/.test(ua)) {
    const v = ua.match(/Chrome\/(\d+)/);
    browser = `Chrome ${v?.[1] ?? ''}`;
  } else if (/Version\/(\d+).*Safari/.test(ua)) {
    const v = ua.match(/Version\/(\d+)/);
    browser = `Safari ${v?.[1] ?? ''}`;
  } else {
    browser = '未知瀏覽器';
  }

  return `${device} · ${browser}`;
}
