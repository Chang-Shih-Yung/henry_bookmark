import { auth } from '@/auth';
import {
  parseRedisJson,
  pushSubscriptionsKey,
  redis,
} from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 列出當前 user 所有訂閱裝置(diagnostic 用)。
 * 回傳每台裝置的 endpoint host(讓 user 知道是哪一台)+ 訂閱時間 hash。
 * 純讀,不改動 Redis。
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 });
  }
  const subs = await redis.smembers(
    pushSubscriptionsKey(session.user.email),
  );
  const devices = subs
    .map((raw) => parseRedisJson<{ endpoint: string }>(raw))
    .filter((s): s is { endpoint: string } => !!s)
    .map((s) => {
      try {
        const url = new URL(s.endpoint);
        return {
          provider: hostToProvider(url.host),
          host: url.host,
          hash: s.endpoint.slice(-12),
          // endpoint 拿來給 DELETE 用 — 是 user 自己的 sub,曝露給自己 OK
          endpoint: s.endpoint,
        };
      } catch {
        return { provider: 'unknown', host: '', hash: '', endpoint: '' };
      }
    });

  return Response.json({ count: devices.length, devices });
}

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
