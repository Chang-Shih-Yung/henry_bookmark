import { auth } from '@/auth';
import { holdingsKey, redis } from '@/lib/redis';
import { defaultHoldings } from '@/lib/defaultHoldings';
import type { Holdings } from '@/lib/types';
import { z } from 'zod';

const TransactionSchema = z.object({
  id: z.string(),
  kind: z.enum(['buy', 'sell', 'monthly_dca', 'manual_adjust', 'initial']),
  unitsDelta: z.number(),
  costDeltaTwd: z.number(),
  costDeltaUsd: z.number().optional(),
  pricePerUnitTwd: z.number().optional(),
  occurredAt: z.string(),
  recordedAt: z.string(),
  notes: z.string().optional(),
});

const HoldingSchema = z.object({
  id: z.string(),
  type: z.enum(['tw_stock', 'us_stock', 'crypto', 'cash_twd', 'cash_usd', 'trust']),
  symbol: z.string(),
  displayName: z.string(),
  units: z.number().nonnegative(),
  costBasisTwd: z.number().nonnegative(),
  costBasisUsd: z.number().nonnegative().optional(),
  realizedPnlTwd: z.number().optional(),
  monthlyAutoBuyTwd: z.number().nonnegative().optional(),
  monthlyAutoBuyUsd: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  updatedAt: z.string(),
  transactions: z.array(TransactionSchema).optional(),
});

const HoldingsSchema = z.object({
  schemaVersion: z.literal(2),
  items: z.array(HoldingSchema),
  lastModified: z.string(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 });
  }
  const key = holdingsKey(session.user.email);
  const stored = await redis.get<Holdings>(key);
  return Response.json(stored ?? defaultHoldings());
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const parsed = HoldingsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_holdings_schema', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const key = holdingsKey(session.user.email);
  const toStore: Holdings = {
    ...parsed.data,
    lastModified: new Date().toISOString(),
  };
  await redis.set(key, toStore);
  return new Response(null, { status: 204 });
}
