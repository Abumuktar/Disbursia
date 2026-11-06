const ngn = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 });
const ngnShort = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', notation: 'compact', maximumFractionDigits: 2 });
const int = new Intl.NumberFormat('en-NG');

/** kobo -> "₦1,234.56" */
export const naira = (kobo: number) => ngn.format(kobo / 100);
export const nairaShort = (kobo: number) => ngnShort.format(kobo / 100);
export const num = (n: number) => int.format(n);
export const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

export const dateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const dateOnly = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const timeSecs = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

export function duration(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export const maskPhone = (p: string) => p.replace(/^(\+?\d{4})\d+(\d{3})$/, '$1•••••$2');

export function amountWords(kobo: number): string {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const below1000 = (n: number): string => {
    const parts: string[] = [];
    if (n >= 100) { parts.push(`${ones[Math.floor(n / 100)]} hundred`); n %= 100; if (n) parts.push('and'); }
    if (n >= 20) { parts.push(tens[Math.floor(n / 10)] + (n % 10 ? `-${ones[n % 10]}` : '')); }
    else if (n > 0) parts.push(ones[n]);
    return parts.join(' ');
  };
  const words = (n: number): string => {
    if (n === 0) return 'zero';
    const scales: [number, string][] = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
    const out: string[] = [];
    for (const [v, name] of scales) {
      if (n >= v) { out.push(`${below1000(Math.floor(n / v))} ${name}`); n %= v; }
    }
    if (n) out.push(below1000(n));
    return out.join(', ');
  };
  const naira = Math.floor(kobo / 100);
  const k = kobo % 100;
  const s = `${words(naira)} naira${k ? `, ${words(k)} kobo` : ''} only`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
