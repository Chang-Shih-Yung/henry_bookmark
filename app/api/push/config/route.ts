import { auth } from '@/auth';
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
  const session = await auth();
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 });
  }
  const cfg = await redis.get<ReminderConfig>(
    reminderConfigKey(session.user.email),
  );
  return Response.json(cfg ?? DEFAULT_REMINDER_CONFIG);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const key = reminderConfigKey(session.user.email);
  const existing = await redis.get<ReminderConfig>(key);
  const next: ReminderConfig = {
    ...DEFAULT_REMINDER_CONFIG,
    ...(existing ?? {}),
    ...parsed.data,
  };
  await redis.set(key, next);
  return Response.json(next);
}
