const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export const money = (n: number | null | undefined): string =>
  n == null ? '—' : currency.format(n);

export const shortDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const dayLabel = (iso: string): string => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

export const weekday = (iso: string): string =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });

export const daysUntil = (isoDate: string | null | undefined): number | null => {
  if (!isoDate) return null;
  const target = new Date(`${isoDate.slice(0, 10)}T23:59:59`);
  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
};

/** Every date (YYYY-MM-DD) from start to end inclusive. */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start.slice(0, 10)}T00:00:00`);
  const last = new Date(`${end.slice(0, 10)}T00:00:00`);
  while (d <= last && out.length < 60) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Parse a price text input; empty → null, junk → null. */
export const parseMoney = (raw: string): number | null => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

export const clampQty = (raw: string | number, fallback = 1): number => {
  const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 99) : fallback;
};

export const percent = (n: number): string => `${Math.max(0, Math.min(100, Math.round(n)))}%`;

export const timeAgo = (iso: string): string => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
};
