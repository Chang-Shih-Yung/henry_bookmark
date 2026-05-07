/**
 * 數字呈現工具。手機優先,預設 compact(中文「萬」單位),tap 切 full。
 */

const twdFmt = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  maximumFractionDigits: 0,
});

const numFmt = new Intl.NumberFormat('zh-TW');

export function formatTwd(n: number, _mode: 'compact' | 'full' = 'compact'): string {
  if (!isFinite(n)) return '—';
  // 一律顯示完整數字 — 仿國泰證券 app(NT$ 94,444 而不是 9.4 萬)
  return twdFmt.format(Math.round(n));
}

export function formatPct(n: number, digits = 1): string {
  if (!isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${(n * 100).toFixed(digits)}%`;
}

export function formatChange(n: number): string {
  if (!isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${formatTwd(n, 'compact')}`;
}

/**
 * 把 ISO 時間戳格式化成「使用者一眼讀懂這多久前」。
 * 剛剛 / 5 分鐘前 / 今天 17:30 / 昨天 17:30 / 5/4 17:30 / 2026/5/4
 */
export function formatUpdatedAt(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!isFinite(d.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const min = Math.floor(diffMs / 60_000);

  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;

  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');

  if (d.toDateString() === now.toDateString()) {
    return `今天 ${hh}:${mm}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `昨天 ${hh}:${mm}`;
  }

  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
  }
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatUnits(n: number, type: string): string {
  if (!isFinite(n)) return '—';
  // crypto 顯示到 8 位(幣安到 8),零股美股顯示到 5 位(銀行 app 5 位)
  if (type === 'crypto') {
    return n.toLocaleString('zh-TW', { maximumFractionDigits: 8 });
  }
  if (type === 'us_stock') {
    return n.toLocaleString('zh-TW', { maximumFractionDigits: 5 });
  }
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
}

export function formatUsd(n: number): string {
  if (!isFinite(n)) return '—';
  return `$ ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/**
 * 每單位的「價格」(成交均價、即時價、漲跌參考價)。永遠保留 2 位小數,
 * 不四捨五入到整數 — 70.73 就顯示 70.73。
 * 千分位照當地慣例:USD 用 en-US,TWD 用 zh-TW。
 */
export function formatPrice(n: number, currency: 'TWD' | 'USD'): string {
  if (!isFinite(n)) return '—';
  if (currency === 'USD') {
    return `$ ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
  return `NT$ ${n.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}`;
}
