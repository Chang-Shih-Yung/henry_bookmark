import {
  enabledRemindersKey,
  pushSubscriptionsKey,
  redis,
  reminderConfigKey,
} from '@/lib/redis';
import { sendPushToSubscription, type ReminderConfig } from '@/lib/webpush';
import type { PushSubscription as WPSubscription } from 'web-push';

/**
 * Vercel Cron 每日台北 12:00 (UTC 04:00) 觸發。
 * 每月 6 號(預設,可在 settings 改)發一次 push 提醒記帳:
 *   - 台股月扣(每月 3 號交易日)+ 美股月扣(每月 5 號交易日)
 *   - 6 號是兩家都扣完之後,一次性提醒
 *
 * Vercel Cron 預設透過 GET 觸發,自動帶 Authorization Bearer (CRON_SECRET)。
 */
export const runtime = 'nodejs'; // web-push 需要 Node runtime
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

function getTaipeiDate(): { day: number; hour: number } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    day: 'numeric',
    hour: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return { day, hour };
}

export async function GET(req: Request) {
  // Vercel Cron 自動帶 Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { day, hour } = getTaipeiDate();

  // 取所有啟用提醒的 emails
  const emails = await redis.smembers(enabledRemindersKey());

  let sentCount = 0;
  let expiredCount = 0;
  const errors: string[] = [];

  for (const email of emails) {
    const cfg = await redis.get<ReminderConfig>(reminderConfigKey(email));
    if (!cfg || !cfg.enabled) continue;
    if (day !== cfg.day || hour !== cfg.hour) continue;

    // 取出該 user 所有訂閱裝置
    const subs = await redis.smembers(pushSubscriptionsKey(email));
    for (const raw of subs) {
      let sub: WPSubscription;
      try {
        sub = JSON.parse(raw) as WPSubscription;
      } catch {
        continue;
      }
      const result = await sendPushToSubscription(sub, {
        title: cfg.title,
        body: cfg.body,
        url: '/',
        tag: 'monthly-dca',
      });
      if (result.ok) {
        sentCount++;
      } else if (result.expired) {
        // 移除過期 subscription
        await redis.srem(pushSubscriptionsKey(email), raw);
        expiredCount++;
      } else {
        errors.push(`${email}: ${result.statusCode}`);
      }
    }
  }

  return Response.json({
    ok: true,
    day,
    hour,
    sentCount,
    expiredCount,
    errors,
  });
}
