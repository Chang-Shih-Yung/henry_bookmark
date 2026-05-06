import { z } from 'zod';
import type { PricesResponse } from '@/lib/types';

export const runtime = 'edge';
export const revalidate = 60;

const yahooSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({
            regularMarketPrice: z.number(),
            previousClose: z.number().optional(),
            chartPreviousClose: z.number().optional(),
          }),
        }),
      )
      .min(1),
  }),
});

const coingeckoSchema = z.record(
  z.string(),
  z.object({
    twd: z.number(),
    twd_24h_change: z.number().optional(),
  }),
);

const fxSchema = z.object({
  rates: z.object({ TWD: z.number() }),
});

type YahooQuote = { current: number; prev: number | null };

async function fetchYahoo(symbol: string): Promise<YahooQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const res = await fetch(url, {
    next: { revalidate: 60 },
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`yahoo ${symbol} HTTP ${res.status}`);
  const json = await res.json();
  const parsed = yahooSchema.parse(json);
  const meta = parsed.chart.result[0].meta;
  return {
    current: meta.regularMarketPrice,
    prev: meta.previousClose ?? meta.chartPreviousClose ?? null,
  };
}

type CryptoQuotes = {
  btc: { twd: number; pct24h: number | null };
  eth: { twd: number; pct24h: number | null };
  ada: { twd: number; pct24h: number | null };
  doge: { twd: number; pct24h: number | null };
};

async function fetchCoingecko(): Promise<CryptoQuotes> {
  const url =
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,cardano,dogecoin&vs_currencies=twd&include_24hr_change=true';
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`coingecko HTTP ${res.status}`);
  const json = await res.json();
  const parsed = coingeckoSchema.parse(json);
  const pick = (id: string) => {
    const e = parsed[id];
    return {
      twd: e?.twd ?? NaN,
      pct24h: typeof e?.twd_24h_change === 'number' ? e.twd_24h_change : null,
    };
  };
  return {
    btc: pick('bitcoin'),
    eth: pick('ethereum'),
    ada: pick('cardano'),
    doge: pick('dogecoin'),
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

/** 從 24h 漲跌幅反推 prev:prev = current / (1 + pct/100)。 */
function prevFromPct(current: number, pct: number | null): number | null {
  if (pct === null) return null;
  const factor = 1 + pct / 100;
  if (factor <= 0) return null;
  return current / factor;
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

  // US stocks current = USD × FX, prev 同樣用 today FX (避免 FX 變動污染漲跌)
  const googlTwd =
    googlR.value !== null && usdTwd !== null
      ? googlR.value.current * usdTwd
      : null;
  const googlPrevTwd =
    googlR.value?.prev != null && usdTwd !== null
      ? googlR.value.prev * usdTwd
      : null;
  const vtiTwd =
    vtiR.value !== null && usdTwd !== null ? vtiR.value.current * usdTwd : null;
  const vtiPrevTwd =
    vtiR.value?.prev != null && usdTwd !== null
      ? vtiR.value.prev * usdTwd
      : null;

  const btc = cryptoR.value && Number.isFinite(cryptoR.value.btc.twd)
    ? cryptoR.value.btc.twd
    : null;
  const btcPrev = btc !== null
    ? prevFromPct(btc, cryptoR.value?.btc.pct24h ?? null)
    : null;
  const eth = cryptoR.value && Number.isFinite(cryptoR.value.eth.twd)
    ? cryptoR.value.eth.twd
    : null;
  const ethPrev = eth !== null
    ? prevFromPct(eth, cryptoR.value?.eth.pct24h ?? null)
    : null;
  const ada = cryptoR.value && Number.isFinite(cryptoR.value.ada.twd)
    ? cryptoR.value.ada.twd
    : null;
  const adaPrev = ada !== null
    ? prevFromPct(ada, cryptoR.value?.ada.pct24h ?? null)
    : null;
  const doge = cryptoR.value && Number.isFinite(cryptoR.value.doge.twd)
    ? cryptoR.value.doge.twd
    : null;
  const dogePrev = doge !== null
    ? prevFromPct(doge, cryptoR.value?.doge.pct24h ?? null)
    : null;

  const sources: Record<string, 'ok' | 'failed' | 'fallback'> = {
    tsmc: tsmcR.value !== null ? 'ok' : 'failed',
    etf0050: etfR.value !== null ? 'ok' : 'failed',
    googl: googlTwd !== null ? 'ok' : 'failed',
    vti: vtiTwd !== null ? 'ok' : 'failed',
    btc: btc !== null ? 'ok' : 'failed',
    eth: eth !== null ? 'ok' : 'failed',
    ada: ada !== null ? 'ok' : 'failed',
    doge: doge !== null ? 'ok' : 'failed',
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
    tsmc: tsmcR.value?.current ?? null,
    tsmcPrev: tsmcR.value?.prev ?? null,
    etf0050: etfR.value?.current ?? null,
    etf0050Prev: etfR.value?.prev ?? null,
    googl: googlTwd,
    googlPrev: googlPrevTwd,
    vti: vtiTwd,
    vtiPrev: vtiPrevTwd,
    btc,
    btcPrev,
    eth,
    ethPrev,
    ada,
    adaPrev,
    doge,
    dogePrev,
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
