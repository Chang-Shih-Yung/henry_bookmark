import { z } from 'zod';
import type { PricesResponse, SymbolPrice } from '@/lib/types';

export const runtime = 'edge';
export const revalidate = 15;

/**
 * /api/prices?symbols=tw:2330.TW,tw:0050.TW,us:GOOGL,us:VTI,crypto:BTC,crypto:ETH
 *
 * Client 把當前 holdings 對應的 symbol+kind 用逗號清單帶進來,server 動態
 * dispatch 到對應 provider(Yahoo / CoinGecko)抓報價,回 TWD-normalized
 * symbols Record。Henry 想加任何新部位只要 holdings 有 + client 把 symbol
 * 串進 query,server 會自動抓 — 不再像舊 route 寫死 8 個 fields。
 *
 * Edge runtime 保留:Yahoo / CoinGecko / exchange-rate 都能在 edge fetch,
 * 沒有 Redis / auth 依賴(prices 是純 read-through 公開資料)。
 */

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
    twd: z.number().optional(),
    twd_24h_change: z.number().optional(),
  }),
);

const fxSchema = z.object({
  rates: z.object({ TWD: z.number() }),
});

/** 加密貨幣 symbol → CoinGecko id 的小型 registry,加新幣種改這一處即可。 */
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  SOL: 'solana',
  USDT: 'tether',
  USDC: 'usd-coin',
};

type SymbolRequest = { kind: 'tw_stock' | 'us_stock' | 'crypto'; symbol: string };

/** parse "tw:2330.TW,us:GOOGL,crypto:BTC" → SymbolRequest[] */
function parseSymbolsParam(raw: string): SymbolRequest[] {
  if (!raw) return [];
  const out: SymbolRequest[] = [];
  for (const item of raw.split(',')) {
    const [kindRaw, ...rest] = item.split(':');
    const symbol = rest.join(':').trim();
    if (!symbol) continue;
    const kind =
      kindRaw === 'tw'
        ? 'tw_stock'
        : kindRaw === 'us'
          ? 'us_stock'
          : kindRaw === 'crypto'
            ? 'crypto'
            : null;
    if (!kind) continue;
    out.push({ kind, symbol });
  }
  return out;
}

type YahooQuote = { current: number; prev: number | null };

async function fetchYahoo(symbol: string): Promise<YahooQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const res = await fetch(url, {
    next: { revalidate: 15 },
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

async function fetchUsdTwd(): Promise<number> {
  const url = 'https://open.er-api.com/v6/latest/USD';
  const res = await fetch(url, { next: { revalidate: 15 } });
  if (!res.ok) throw new Error(`exchangerate HTTP ${res.status}`);
  const json = await res.json();
  const parsed = fxSchema.parse(json);
  return parsed.rates.TWD;
}

/** 從 24h 漲跌幅反推 prev:prev = current / (1 + pct/100)。 */
function prevFromPct(current: number, pct: number | null): number | null {
  if (pct === null) return null;
  const factor = 1 + pct / 100;
  if (factor <= 0) return null;
  return current / factor;
}

/** 一次 fetch 多個 crypto symbol — CoinGecko 支援 ?ids=a,b,c 批次 */
async function fetchCryptos(symbols: string[]): Promise<
  Record<string, { current: number; prev: number | null }>
> {
  if (symbols.length === 0) return {};
  const ids = symbols
    .map((s) => COINGECKO_IDS[s.toUpperCase()])
    .filter((id): id is string => !!id);
  if (ids.length === 0) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=twd&include_24hr_change=true`;
  const res = await fetch(url, { next: { revalidate: 15 } });
  if (!res.ok) throw new Error(`coingecko HTTP ${res.status}`);
  const json = await res.json();
  const parsed = coingeckoSchema.parse(json);
  const out: Record<string, { current: number; prev: number | null }> = {};
  for (const sym of symbols) {
    const id = COINGECKO_IDS[sym.toUpperCase()];
    if (!id) continue;
    const entry = parsed[id];
    if (!entry?.twd || !Number.isFinite(entry.twd)) continue;
    out[sym] = {
      current: entry.twd,
      prev: prevFromPct(entry.twd, typeof entry.twd_24h_change === 'number' ? entry.twd_24h_change : null),
    };
  }
  return out;
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requested = parseSymbolsParam(url.searchParams.get('symbols') ?? '');

  // dedupe + 分組
  const twSymbols = [
    ...new Set(requested.filter((r) => r.kind === 'tw_stock').map((r) => r.symbol)),
  ];
  const usSymbols = [
    ...new Set(requested.filter((r) => r.kind === 'us_stock').map((r) => r.symbol)),
  ];
  const cryptoSymbols = [
    ...new Set(requested.filter((r) => r.kind === 'crypto').map((r) => r.symbol)),
  ];

  // FX 永遠抓(美股 / cash_usd 都要)
  const fxR = timed(() => fetchUsdTwd());

  // 平行 fetch 全部 — 每個 symbol 各自一個 timed fetch,失敗不影響其他
  const twFetches = twSymbols.map((sym) =>
    timed(() => fetchYahoo(sym)).then((r) => ({ sym, r })),
  );
  const usFetches = usSymbols.map((sym) =>
    timed(() => fetchYahoo(sym)).then((r) => ({ sym, r })),
  );
  const cryptoR = timed(() => fetchCryptos(cryptoSymbols));

  const [fxResolved, twResolved, usResolved, cryptoResolved] = await Promise.all([
    fxR,
    Promise.all(twFetches),
    Promise.all(usFetches),
    cryptoR,
  ]);

  const usdTwd = fxResolved.value ?? null;

  const symbols: Record<string, SymbolPrice> = {};
  const sources: Record<string, 'ok' | 'failed'> = {
    usdTwd: usdTwd !== null ? 'ok' : 'failed',
  };
  const latencyMs: Record<string, number> = { usdTwd: fxResolved.ms };
  const errors: PricesResponse['errors'] = [];

  if (fxResolved.error) {
    errors.push({ source: 'exchangerate', message: fxResolved.error });
  }

  // TW stocks — 已是 TWD per share,直接用
  for (const { sym, r } of twResolved) {
    sources[sym] = r.value !== null ? 'ok' : 'failed';
    latencyMs[sym] = r.ms;
    if (r.error) errors.push({ source: `yahoo:${sym}`, message: r.error });
    symbols[sym] = {
      currentTwd: r.value?.current ?? null,
      prevTwd: r.value?.prev ?? null,
    };
  }

  // US stocks — fetchYahoo 回 USD,在這裡 × usdTwd 換算 TWD
  // prev 也用「同一個當下的 usdTwd」換算,避免 FX 變動污染漲跌幅
  for (const { sym, r } of usResolved) {
    sources[sym] = r.value !== null && usdTwd !== null ? 'ok' : 'failed';
    latencyMs[sym] = r.ms;
    if (r.error) errors.push({ source: `yahoo:${sym}`, message: r.error });
    const currTwd =
      r.value !== null && usdTwd !== null ? r.value.current * usdTwd : null;
    const prevTwd =
      r.value?.prev != null && usdTwd !== null ? r.value.prev * usdTwd : null;
    symbols[sym] = { currentTwd: currTwd, prevTwd };
  }

  // Crypto — 已是 TWD,直接用
  if (cryptoResolved.error) {
    errors.push({ source: 'coingecko', message: cryptoResolved.error });
  }
  latencyMs.crypto = cryptoResolved.ms;
  for (const sym of cryptoSymbols) {
    const entry = cryptoResolved.value?.[sym];
    sources[sym] = entry ? 'ok' : 'failed';
    if (entry) {
      symbols[sym] = { currentTwd: entry.current, prevTwd: entry.prev };
    } else {
      symbols[sym] = { currentTwd: null, prevTwd: null };
    }
  }

  const body: PricesResponse = {
    symbols,
    usdTwd,
    fetchedAt: new Date().toISOString(),
    _debug: { sources, latencyMs },
    ...(errors.length > 0 ? { errors } : {}),
  };

  return Response.json(body, {
    headers: {
      'Cache-Control': 's-maxage=15, stale-while-revalidate=120',
    },
  });
}
