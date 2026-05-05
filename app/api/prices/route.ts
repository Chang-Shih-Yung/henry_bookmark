import { z } from 'zod';
import type { PricesResponse } from '@/lib/types';

export const runtime = 'edge';
export const revalidate = 60;

// Yahoo Finance chart endpoint shape (only the field we care about)
const yahooSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({ regularMarketPrice: z.number() }),
        }),
      )
      .min(1),
  }),
});

const coingeckoSchema = z.record(
  z.string(),
  z.object({ twd: z.number() }),
);

const fxSchema = z.object({
  rates: z.object({ TWD: z.number() }),
});

type Source =
  | 'tsmc'
  | 'etf0050'
  | 'googl'
  | 'vti'
  | 'btc'
  | 'eth'
  | 'ada'
  | 'usdTwd';

async function fetchYahoo(symbol: string): Promise<number> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const res = await fetch(url, {
    next: { revalidate: 60 },
    headers: {
      // Yahoo blocks default fetch UA; pretend to be a browser
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`yahoo ${symbol} HTTP ${res.status}`);
  const json = await res.json();
  const parsed = yahooSchema.parse(json);
  return parsed.chart.result[0].meta.regularMarketPrice;
}

async function fetchCoingecko(): Promise<{
  btc: number;
  eth: number;
  ada: number;
}> {
  const url =
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,cardano&vs_currencies=twd';
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`coingecko HTTP ${res.status}`);
  const json = await res.json();
  const parsed = coingeckoSchema.parse(json);
  return {
    btc: parsed.bitcoin?.twd ?? NaN,
    eth: parsed.ethereum?.twd ?? NaN,
    ada: parsed.cardano?.twd ?? NaN,
  };
}

async function fetchUsdTwd(): Promise<number> {
  const url = 'https://open.er-api.com/v6/latest/USD';
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`exchangerate HTTP ${res.status}`);
  const json = await res.json();
  const parsed = fxSchema.parse(json);
  return parsed.rates.TWD;
}

type Resolved = { value: number | null; ms: number; error?: string };

async function timed<T>(fn: () => Promise<T>): Promise<{
  value: T | null;
  ms: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const value = await fn();
    return { value, ms: Date.now() - start };
  } catch (e) {
    return {
      value: null,
      ms: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET() {
  const [tsmcR, etfR, googlR, vtiR, cryptoR, fxR] = await Promise.all([
    timed(() => fetchYahoo('2330.TW')),
    timed(() => fetchYahoo('0050.TW')),
    timed(() => fetchYahoo('GOOGL')),
    timed(() => fetchYahoo('VTI')),
    timed(() => fetchCoingecko()),
    timed(() => fetchUsdTwd()),
  ]);

  const usdTwd = fxR.value ?? null;

  // US stocks: convert USD → TWD using live FX
  const googlTwd =
    googlR.value !== null && usdTwd !== null ? googlR.value * usdTwd : null;
  const vtiTwd =
    vtiR.value !== null && usdTwd !== null ? vtiR.value * usdTwd : null;

  const sources: Record<string, 'ok' | 'failed' | 'fallback'> = {
    tsmc: tsmcR.value !== null ? 'ok' : 'failed',
    etf0050: etfR.value !== null ? 'ok' : 'failed',
    googl: googlTwd !== null ? 'ok' : 'failed',
    vti: vtiTwd !== null ? 'ok' : 'failed',
    btc: cryptoR.value && Number.isFinite(cryptoR.value.btc) ? 'ok' : 'failed',
    eth: cryptoR.value && Number.isFinite(cryptoR.value.eth) ? 'ok' : 'failed',
    ada: cryptoR.value && Number.isFinite(cryptoR.value.ada) ? 'ok' : 'failed',
    usdTwd: usdTwd !== null ? 'ok' : 'failed',
  };

  const latencyMs: Record<string, number> = {
    tsmc: tsmcR.ms,
    etf0050: etfR.ms,
    googl: googlR.ms,
    vti: vtiR.ms,
    crypto: cryptoR.ms,
    usdTwd: fxR.ms,
  };

  const errors: PricesResponse['errors'] = [];
  if (tsmcR.error) errors.push({ source: 'yahoo:2330', message: tsmcR.error });
  if (etfR.error) errors.push({ source: 'yahoo:0050', message: etfR.error });
  if (googlR.error) errors.push({ source: 'yahoo:GOOGL', message: googlR.error });
  if (vtiR.error) errors.push({ source: 'yahoo:VTI', message: vtiR.error });
  if (cryptoR.error) errors.push({ source: 'coingecko', message: cryptoR.error });
  if (fxR.error) errors.push({ source: 'exchangerate', message: fxR.error });

  const body: PricesResponse = {
    tsmc: tsmcR.value,
    etf0050: etfR.value,
    googl: googlTwd,
    vti: vtiTwd,
    btc: cryptoR.value && Number.isFinite(cryptoR.value.btc) ? cryptoR.value.btc : null,
    eth: cryptoR.value && Number.isFinite(cryptoR.value.eth) ? cryptoR.value.eth : null,
    ada: cryptoR.value && Number.isFinite(cryptoR.value.ada) ? cryptoR.value.ada : null,
    usdTwd,
    fetchedAt: new Date().toISOString(),
    _debug: { sources, latencyMs },
    ...(errors.length > 0 ? { errors } : {}),
  };

  return Response.json(body, {
    headers: {
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
    },
  });
}
