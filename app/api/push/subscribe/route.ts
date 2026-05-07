import { auth } from '@/auth';
import {
  enabledRemindersKey,
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
    return new Response('Unauthorized', { status: 401 });
  }
  const email = session.user.email;
  const json = await req.json().catch(() => null);
  const parsed = SubscribeBody.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const subKey = pushSubscriptionsKey(email);
  // sadd 把這個 subscription 加到 user 的 set(同 endpoint 不會重複)
  await redis.sadd(subKey, JSON.stringify(parsed.data.subscription));

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
    const all = await redis.smembers(subKey);
    for (const item of all) {
      try {
        const parsed = JSON.parse(item);
        if (parsed.endpoint === endpoint) {
          await redis.srem(subKey, item);
        }
      } catch {
        // 忽略無法解析的 entry
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
