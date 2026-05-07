import { auth } from '@/auth';
import { pushSubscriptionsKey, redis, reminderConfigKey } from '@/lib/redis';
import { sendPushToSubscription, type ReminderConfig } from '@/lib/webpush';
import type { PushSubscription as WPSubscription } from 'web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 發送測試通知到當前 user 的所有訂閱裝置 — 用來驗證 push 配置是否正確。
 * 不檢查當天日期 / 時數,跳過 cron 排程,直接發。
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 });
  }
  const email = session.user.email;

  // 提早抓 VAPID 環境變數,缺就直接回明確錯誤
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return Response.json(
      { ok: false, reason: '伺服器 VAPID 金鑰未設定 — Vercel env 缺 NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY' },
      { status: 200 },
    );
  }

  const subs = await redis.smembers(pushSubscriptionsKey(email));
  if (subs.length === 0) {
    return Response.json(
      { ok: false, reason: '沒有訂閱裝置 — 請先啟用提醒' },
      { status: 200 },
    );
  }

  const cfg =
    (await redis.get<ReminderConfig>(reminderConfigKey(email))) ??
    null;

  let sentCount = 0;
  let expiredCount = 0;
  const errors: Array<{ statusCode: number; message?: string }> = [];

  for (const raw of subs) {
    let sub: WPSubscription;
    try {
      sub = JSON.parse(raw) as WPSubscription;
    } catch {
      continue;
    }
    const result = await sendPushToSubscription(sub, {
      title: cfg?.title ?? '月扣記錄日(測試)',
      body: cfg?.body ?? '這是一則測試通知,確認 push 配置正常。',
      url: '/',
      tag: 'test-notification',
    });
    if (result.ok) {
      sentCount++;
    } else if (result.expired) {
      await redis.srem(pushSubscriptionsKey(email), raw);
      expiredCount++;
    } else {
      errors.push({ statusCode: result.statusCode, message: result.message });
    }
  }

  // 沒成功 → 給人話的 reason
  let reason: string | undefined;
  if (sentCount === 0) {
    if (expiredCount > 0 && errors.length === 0) {
      reason = `所有 ${expiredCount} 台裝置訂閱已過期 — 請重新啟用提醒(關掉再開)`;
    } else if (errors.length > 0) {
      const first = errors[0];
      reason = `推送失敗 (HTTP ${first.statusCode})${first.message ? ': ' + first.message : ''}`;
    } else {
      reason = '推送失敗 — 沒有任何裝置成功';
    }
  }

  return Response.json({
    ok: sentCount > 0,
    sentCount,
    expiredCount,
    errors,
    reason,
  });
}
