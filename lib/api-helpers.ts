import { auth } from '@/auth';

/**
 * 7 個 API route 都要做相同的 auth check,抽出來 DRY。
 * 用法:
 *   const session = await requireAuth();
 *   if (!session.ok) return session.response;
 *   const email = session.email;
 */
export async function requireAuth(): Promise<
  | { ok: true; email: string }
  | { ok: false; response: Response }
> {
  const s = await auth();
  if (!s?.user?.email) {
    return {
      ok: false,
      response: errorResponse(401, 'unauthorized', '請先登入'),
    };
  }
  return { ok: true, email: s.user.email };
}

/**
 * 統一的 error response 格式 — 之前散在各 route 的 { error, issues } /
 * { ok, reason } / plain text 三種寫法收斂成一個:
 *
 *   { ok: false, error: 'invalid_body' | 'unauthorized' | ..., reason?: '人話',
 *     issues?: ZodIssue[] }
 *
 * client toast 直接讀 reason 就好。
 */
export function errorResponse(
  status: number,
  error: string,
  reason?: string,
  extra?: Record<string, unknown>,
): Response {
  return Response.json(
    { ok: false, error, ...(reason ? { reason } : {}), ...(extra ?? {}) },
    { status },
  );
}

/** 成功 response 約定:有 payload 就直接回,沒則 { ok: true } */
export function okResponse<T extends Record<string, unknown>>(
  payload?: T,
): Response {
  return Response.json({ ok: true, ...(payload ?? {}) });
}
