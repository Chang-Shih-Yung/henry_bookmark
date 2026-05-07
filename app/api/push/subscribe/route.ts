import { auth } from '@/auth';
import {
  enabledRemindersKey,
  parseRedisJson,
  pushSubscriptionsKey,
  redis,
  reminderConfigKey,
} from '@/lib/redis';
import { DEFAULT_REMINDER_CONFIG, type ReminderConfig } from '@/lib/webpush';
import { z } from 'zod';

const SubscribeBody = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
  config: z
    .object({
      day: z.number().int().min(1).max(28).optional(),
      hour: z.number().int().min(0).max(23).optional(),
      title: z.string().min(1).max(60).optional(),
      body: z.string().min(1).max(200).optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    console.warn('[push/subscribe] unauthorized — no session');
    return new Response('Unauthorized', { status: 401 });
  }
  const email = session.user.email;
  const json = await req.json().catch(() => null);
  const parsed = SubscribeBody.safeParse(json);
  if (!parsed.success) {
    console.error('[push/subscribe] invalid_body', email, parsed.error.issues);
    return Response.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  console.log(
    '[push/subscribe] adding subscription',
    email,
    'endpoint host:',
    new URL(parsed.data.subscription.endpoint).host,
  );

  // 包成 { subscription, userAgent, subscribedAt } 給後續 listing 顯示「哪一台」用
  // 同 endpoint 重複 POST 會多進 set(因為 JSON 字串多了 timestamp 不同) →
  // 先掃 set 移除同 endpoint 的舊 entry,再 sadd 新的(deduplicate by endpoint)
  const subKey = pushSubscriptionsKey(email);
  const ua = req.headers.get('user-agent') ?? '';
  const newEntry = {
    subscription: parsed.data.subscription,
    userAgent: ua,
    subscribedAt: Date.now(),
  };
  // 清掉同 endpoint 的舊 entry
  const existingAll = await redis.smembers(subKey);
  for (const item of existingAll) {
    const parsed2 = parseRedisJson<{
      endpoint?: string;
      subscription?: { endpoint?: string };
    }>(item);
    const itemEndpoint = parsed2?.endpoint ?? parsed2?.subscription?.endpoint;
    if (itemEndpoint === parsed.data.subscription.endpoint) {
      await redis.srem(subKey, item);
    }
  }
  await redis.sadd(subKey, JSON.stringify(newEntry));

  // 寫入 / 更新 reminder config
  const cfgKey = reminderConfigKey(email);
  const existing = await redis.get<ReminderConfig>(cfgKey);
  const next: ReminderConfig = {
    ...DEFAULT_REMINDER_CONFIG,
    ...(existing ?? {}),
    ...(parsed.data.config ?? {}),
    enabled: true,
  };
  await redis.set(cfgKey, next);

  // 加入「啟用提醒」的全域 set,cron 才知道要 query 誰
  await redis.sadd(enabledRemindersKey(), email.toLowerCase());

  return Response.json({ ok: true, config: next });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 });
  }
  const email = session.user.email;

  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');

  const subKey = pushSubscriptionsKey(email);

  if (endpoint) {
    // 移除單一裝置 — 從 set 找出 endpoint 對應的 entry 並刪掉
    // 兼容兩種格式:bare { endpoint, ... } 或 wrapped { subscription: { endpoint, ... } }
    const all = await redis.smembers(subKey);
    for (const item of all) {
      const parsed = parseRedisJson<{
        endpoint?: string;
        subscription?: { endpoint?: string };
      }>(item);
      const itemEndpoint = parsed?.endpoint ?? parsed?.subscription?.endpoint;
      if (itemEndpoint === endpoint) {
        await redis.srem(subKey, item);
      }
    }
  } else {
    // 不帶 endpoint = 整個 user 全停用
    await redis.del(subKey);
  }

  // 如果 set 已空,從 enabled emails 移除 + 把 config.enabled 設 false
  const remaining = await redis.scard(subKey);
  if (remaining === 0) {
    await redis.srem(enabledRemindersKey(), email.toLowerCase());
    const cfg = await redis.get<ReminderConfig>(reminderConfigKey(email));
    if (cfg) {
      await redis.set(reminderConfigKey(email), { ...cfg, enabled: false });
    }
  }

  return Response.json({ ok: true });
}
