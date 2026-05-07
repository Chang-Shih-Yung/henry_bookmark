import webpush, { type PushSubscription as WPSubscription } from 'web-push';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:henry1010921@gmail.com';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    throw new Error(
      'Missing VAPID keys. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in env.',
    );
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
}

/** 給單一裝置發 push,回傳 success/failure(失敗多半是 410 expired,要從 Redis 移除)。 */
export async function sendPushToSubscription(
  subscription: WPSubscription,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<{ ok: true } | { ok: false; statusCode: number; expired: boolean }> {
  ensureConfigured();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 60 * 60 * 24, // 24h:錯過時間就不送
      urgency: 'normal',
    });
    return { ok: true };
  } catch (e: unknown) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'statusCode' in e &&
      typeof (e as { statusCode?: unknown }).statusCode === 'number'
    ) {
      const code = (e as { statusCode: number }).statusCode;
      // 404 / 410 = subscription expired or unsubscribed by user
      const expired = code === 404 || code === 410;
      return { ok: false, statusCode: code, expired };
    }
    return { ok: false, statusCode: 0, expired: false };
  }
}

export type ReminderConfig = {
  enabled: boolean;
  /** 每月幾號提醒(預設 6 — 美股最後扣完,一次提醒記台股+美股月扣)。 */
  day: number;
  /** 幾點提醒(0-23,預設 12)。 */
  hour: number;
  /** 通知標題,可自訂。 */
  title: string;
  /** 通知內容,可自訂。 */
  body: string;
};

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  enabled: false,
  day: 6,
  hour: 12,
  title: '月扣記錄日',
  body: '台股(0050+台積電)、美股(VTI+GOOGL)的定期定額扣完了,打開 app 抄累計總額。',
};
