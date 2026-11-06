import { useSyncExternalStore, type ReactNode } from 'react';
import { CheckCircle2, MessageSquareText, XCircle, X } from 'lucide-react';
import { cx } from './ui';

type Kind = 'success' | 'error' | 'sms';
interface Toast { id: number; kind: Kind; title: string; body?: ReactNode; ttl: number }

let toasts: Toast[] = [];
let n = 0;
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());

export function toast(kind: Kind, title: string, body?: ReactNode, ttl = kind === 'sms' ? 20000 : 5000) {
  const t = { id: ++n, kind, title, body, ttl };
  toasts = [...toasts, t];
  emit();
  setTimeout(() => dismiss(t.id), ttl);
}
function dismiss(id: number) { toasts = toasts.filter((t) => t.id !== id); emit(); }

export function Toaster() {
  const list = useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => toasts);
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 print:hidden">
      {list.map((t) => (
        <div key={t.id} className={cx('pointer-events-auto flex gap-3 rounded-xl border bg-white p-4 shadow-lg',
          t.kind === 'success' && 'border-brand-200', t.kind === 'error' && 'border-danger-200', t.kind === 'sms' && 'border-gold-300 bg-gold-50')}>
          {t.kind === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" />}
          {t.kind === 'error' && <XCircle className="h-5 w-5 shrink-0 text-danger-600" />}
          {t.kind === 'sms' && <MessageSquareText className="h-5 w-5 shrink-0 text-gold-700" />}
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-slate-900">{t.title}</p>
            {t.body && <div className="mt-0.5 text-slate-600">{t.body}</div>}
          </div>
          <button onClick={() => dismiss(t.id)} className="self-start text-slate-400 hover:text-slate-600" aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}
