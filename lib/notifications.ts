'use client';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** Convert base64 url-safe string to Uint8Array(applicationServerKey 要的格式)。 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.error('SW register failed', e);
    return null;
  }
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribePush(
  config?: { day?: number; hour?: number; title?: string; body?: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isPushSupported()) {
    return { ok: false, reason: '此裝置 / 瀏覽器不支援推送通知' };
  }
  if (!VAPID_PUBLIC) {
    return { ok: false, reason: 'VAPID public key 未設定' };
  }

  // 1. 請求授權
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, reason: '通知權限未授權' };
  }

  // 2. 註冊 service worker
  const reg = await registerServiceWorker();
  if (!reg) {
    return { ok: false, reason: 'Service Worker 註冊失敗' };
  }

  // 3. subscribe push
  let subscription: PushSubscription;
  try {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC).buffer as ArrayBuffer,
    });
  } catch (e) {
    return {
      ok: false,
      reason:
        '訂閱失敗:' + (e instanceof Error ? e.message : String(e)),
    };
  }

  // 4. 上傳 subscription 到 server
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      config,
    }),
  });

  if (!res.ok) {
    return { ok: false, reason: `Server 回 ${res.status}` };
  }

  return { ok: true };
}

export async function unsubscribePush(): Promise<{ ok: boolean }> {
  const sub = await getCurrentSubscription();
  if (!sub) return { ok: true };
  const endpoint = sub.endpoint;

  // 從 server 移除
  await fetch(
    `/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`,
    { method: 'DELETE' },
  );

  // 從瀏覽器 unsubscribe
  await sub.unsubscribe();
  return { ok: true };
}

export async function patchReminderConfig(patch: {
  day?: number;
  hour?: number;
  title?: string;
  body?: string;
}): Promise<{ ok: boolean }> {
  const res = await fetch('/api/push/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return { ok: res.ok };
}

export async function fetchReminderConfig(): Promise<{
  enabled: boolean;
  day: number;
  hour: number;
  title: string;
  body: string;
} | null> {
  const res = await fetch('/api/push/config');
  if (!res.ok) return null;
  return res.json();
}
