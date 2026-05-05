/**
 * 數字呈現工具。手機優先,預設 compact(中文「萬」單位),tap 切 full。
 */

const twdFmt = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  maximumFractionDigits: 0,
});

const numFmt = new Intl.NumberFormat('zh-TW');

export function formatTwd(n: number, mode: 'compact' | 'full' = 'compact'): string {
  if (!isFinite(n)) return '—';
  if (mode === 'full') return twdFmt.format(Math.round(n));

  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e8) return `${sign}NT$ ${(abs / 1e8).toFixed(2)} 億`;
  if (abs >= 1e4) return `${sign}NT$ ${Math.round(abs / 1e4)} 萬`;
  return `${sign}NT$ ${numFmt.format(Math.round(abs))}`;
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

export function formatUnits(n: number, type: string): string {
  if (!isFinite(n)) return '—';
  // crypto 顯示到 4 位小數,股票 / 現金 顯示整數或 2 位
  if (type === 'crypto') {
    return n.toLocaleString('zh-TW', { maximumFractionDigits: 4 });
  }
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
}
