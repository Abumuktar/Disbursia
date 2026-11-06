import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2, MinusCircle, X, XCircle } from 'lucide-react';
import type { BatchStatus, PayStatus, VerifyStatus } from '../lib/types';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-600/50',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 shadow-sm disabled:bg-danger-600/50',
  gold: 'bg-gold-400 text-brand-950 hover:bg-gold-300 shadow-sm disabled:opacity-60',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode }>(
  ({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2 text-sm',
        size === 'lg' && 'px-5 py-2.5 text-[15px]',
        variants[variant], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
);

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-xl border border-slate-200 bg-white shadow-card', className)} {...rest}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-600">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = 'green' | 'yellow' | 'red' | 'gray' | 'blue';
const tones: Record<Tone, string> = {
  green: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  yellow: 'bg-gold-50 text-gold-800 ring-gold-500/30',
  red: 'bg-danger-50 text-danger-700 ring-danger-600/20',
  gray: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
};

export function Badge({ tone = 'gray', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const ic = 'h-3.5 w-3.5';
export const BATCH_STATUS: Record<BatchStatus, { label: string; tone: Tone; icon: ReactNode }> = {
  verifying: { label: 'Verifying', tone: 'blue', icon: <Loader2 className={cx(ic, 'animate-spin')} /> },
  verified: { label: 'Draft · verified', tone: 'gray', icon: <Clock className={ic} /> },
  pending_authorization: { label: 'Awaiting authorization', tone: 'yellow', icon: <Clock className={ic} /> },
  awaiting_second_signature: { label: 'Awaiting 2nd signature', tone: 'yellow', icon: <Clock className={ic} /> },
  processing: { label: 'Paying out', tone: 'blue', icon: <Loader2 className={cx(ic, 'animate-spin')} /> },
  completed: { label: 'Completed', tone: 'green', icon: <CheckCircle2 className={ic} /> },
  completed_with_failures: { label: 'Completed · re-run due', tone: 'yellow', icon: <AlertTriangle className={ic} /> },
  rejected: { label: 'Rejected', tone: 'red', icon: <XCircle className={ic} /> },
  cancelled: { label: 'Discarded', tone: 'gray', icon: <MinusCircle className={ic} /> },
};
export const BatchStatusBadge = ({ status }: { status: BatchStatus }) => {
  const s = BATCH_STATUS[status];
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
};

export const VERIFY: Record<VerifyStatus, { label: string; tone: Tone; icon: ReactNode }> = {
  pending: { label: 'Pending', tone: 'gray', icon: <Clock className={ic} /> },
  matched: { label: 'Matched', tone: 'green', icon: <CheckCircle2 className={ic} /> },
  review: { label: 'Partial match', tone: 'yellow', icon: <AlertTriangle className={ic} /> },
  mismatch: { label: 'Name mismatch', tone: 'red', icon: <XCircle className={ic} /> },
  invalid: { label: 'Invalid account', tone: 'red', icon: <XCircle className={ic} /> },
  duplicate: { label: 'Duplicate', tone: 'yellow', icon: <AlertTriangle className={ic} /> },
};
export const VerifyBadge = ({ status }: { status: VerifyStatus }) => {
  const s = VERIFY[status];
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
};

export const PAY: Record<PayStatus, { label: string; tone: Tone; icon: ReactNode }> = {
  queued: { label: 'Queued', tone: 'blue', icon: <Clock className={ic} /> },
  success: { label: 'Credited', tone: 'green', icon: <CheckCircle2 className={ic} /> },
  failed: { label: 'Failed', tone: 'red', icon: <XCircle className={ic} /> },
  excluded: { label: 'Not paid', tone: 'gray', icon: <MinusCircle className={ic} /> },
};
export const PayBadge = ({ status }: { status?: PayStatus }) => {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  const s = PAY[status];
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
};

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
      {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
    </label>
  );
}

const field = 'block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cx(field, !/\bw-/.test(className ?? '') && 'w-full', className)} {...p} />);
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={cx(field, 'pr-8', !/\bw-/.test(className ?? '') && 'w-full', className)} {...p}>{children}</select>;
export const Textarea = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cx(field, 'w-full', className)} {...p} />;

export function Progress({ value, tone = 'green', className }: { value: number; tone?: 'green' | 'yellow' | 'red'; className?: string }) {
  const color = tone === 'green' ? 'bg-brand-500' : tone === 'yellow' ? 'bg-gold-400' : 'bg-danger-500';
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-300', color)} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className={cx('relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', width)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Pagination({ page, pages, total, onPage, pageSize }: { page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  if (total === 0) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
      <span>Showing <b className="text-slate-700">{from.toLocaleString()}–{to.toLocaleString()}</b> of <b className="text-slate-700">{total.toLocaleString()}</b></span>
      <div className="flex items-center gap-1">
        <button disabled={page === 0} onClick={() => onPage(page - 1)} className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        <span className="px-2">Page {page + 1} of {pages}</span>
        <button disabled={page >= pages - 1} onClick={() => onPage(page + 1)} className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-brand-50 p-3 text-brand-600">{icon}</div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Alert({ tone, title, children, icon }: { tone: 'green' | 'yellow' | 'red'; title?: ReactNode; children?: ReactNode; icon?: ReactNode }) {
  const t = { green: 'border-brand-200 bg-brand-50 text-brand-900', yellow: 'border-gold-200 bg-gold-50 text-gold-900', red: 'border-danger-200 bg-danger-50 text-danger-900' }[tone];
  const Icon = tone === 'green' ? CheckCircle2 : tone === 'yellow' ? AlertTriangle : XCircle;
  return (
    <div className={cx('flex gap-3 rounded-lg border px-4 py-3 text-sm', t)}>
      <span className="mt-0.5 shrink-0">{icon ?? <Icon className="h-4 w-4" />}</span>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(!!title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
    </div>
  );
}

export function KV({ label, children, mono }: { label: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={cx('mt-1 truncate text-sm font-medium text-slate-800', mono && 'font-mono text-[13px]')}>{children}</dd>
    </div>
  );
}
