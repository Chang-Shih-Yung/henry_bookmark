import { errorResponse, requireAuth } from '@/lib/api-helpers';
import { reminderConfigKey, redis } from '@/lib/redis';
import { DEFAULT_REMINDER_CONFIG, type ReminderConfig } from '@/lib/webpush';
import { z } from 'zod';

const PatchBody = z.object({
  day: z.number().int().min(1).max(28).optional(),
  hour: z.number().int().min(0).max(23).optional(),
  title: z.string().min(1).max(60).optional(),
  body: z.string().min(1).max(200).optional(),
});

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const cfg = await redis.get<ReminderConfig>(reminderConfigKey(auth.email));
  return Response.json(cfg ?? DEFAULT_REMINDER_CONFIG);
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, 'invalid_body', '提醒設定欄位驗證失敗', {
      issues: parsed.error.issues,
    });
  }
  const key = reminderConfigKey(auth.email);
  const existing = await redis.get<ReminderConfig>(key);
  const next: ReminderConfig = {
    ...DEFAULT_REMINDER_CONFIG,
    ...(existing ?? {}),
    ...parsed.data,
  };
  await redis.set(key, next);
  return Response.json(next);
}
