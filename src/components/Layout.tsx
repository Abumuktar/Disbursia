import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookCheck, FileStack, Landmark, LayoutDashboard, LogOut, Menu, Send, ShieldCheck, X } from 'lucide-react';
import { useAppState } from '../lib/store';
import { logout } from '../lib/actions';
import { naira } from '../lib/format';
import { bankShort } from '../lib/banks';
import type { Role } from '../lib/types';
import { Crest } from './Crest';
import { LogoPlate } from './Wordmark';
import { cx } from './ui';

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; roles?: Role[] }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/disburse', label: 'New disbursement', icon: Send, roles: ['officer'] },
  { to: '/approvals', label: 'Approvals', icon: BookCheck, roles: ['signatory'] },
  { to: '/batches', label: 'Batches & receipts', icon: FileStack },
  { to: '/programmes', label: 'Programmes & account', icon: Landmark },
  { to: '/audit', label: 'Audit trail', icon: ShieldCheck },
];

export const ROLE_LABEL: Record<Role, string> = { officer: 'Finance Officer', signatory: 'Signatory', auditor: 'Auditor (read-only)' };

export function Layout() {
  const user = useAppState((s) => s.users.find((u) => u.id === s.sessionUserId)!);
  const pending = useAppState((s) => s.batches.filter((b) => b.status === 'pending_authorization' || b.status === 'awaiting_second_signature').length);
  const account = useAppState((s) => s.accounts[0]);
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('');

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-900 text-brand-100">
      <div className="border-b border-white/10 px-5 py-5">
        <LogoPlate size="text-[26px]" className="w-full justify-center" />
        <div className="mt-3 flex items-center gap-2">
          <Crest className="h-7 w-7 shrink-0" />
          <p className="truncate text-[11px] font-medium text-brand-200">Katsina State · Office of the Accountant-General</p>
        </div>
      </div>
      <div className="h-[3px] bg-gold-400" />
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.filter((n) => !n.roles || n.roles.includes(user.role)).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) => cx(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'bg-white/10 text-white shadow-[inset_3px_0_0_#e6b325]' : 'text-brand-200 hover:bg-white/5 hover:text-white',
            )}
          >
            <n.icon className="h-[18px] w-[18px]" />
            <span className="flex-1">{n.label}</span>
            {n.to === '/approvals' && pending > 0 && <span className="rounded-full bg-gold-400 px-2 py-0.5 text-[11px] font-bold text-brand-950">{pending}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-300">Source account</p>
        <p className="mt-1.5 truncate text-sm font-semibold text-white">{account.name}</p>
        <p className="font-mono text-[11px] text-brand-300">{bankShort(account.bankCode)} · {account.accountNumber}</p>
        <p className="mt-1.5 text-sm font-bold text-gold-300 tabular">{naira(account.balance)}</p>
      </div>
      <div className="flex items-center gap-3 border-t border-white/10 px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400 text-sm font-bold text-brand-950">{initials}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{user.name}</p>
          <p className="truncate text-[11px] text-brand-300">{ROLE_LABEL[user.role]}</p>
        </div>
        <button onClick={logout} className="rounded-md p-2 text-brand-300 hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72">{sidebar}</div>
          <button onClick={() => setOpen(false)} className="absolute left-[19rem] top-4 rounded-md bg-white/10 p-2 text-white" aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden font-semibold text-brand-700 sm:inline">Government of Katsina State</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span className="truncate text-slate-500">{user.title}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-gold-50 px-2.5 py-1 text-[11px] font-semibold text-gold-800 ring-1 ring-inset ring-gold-400/40 md:inline-flex" title="Bank calls are simulated. No real money moves.">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-500" /> Pilot · NIBSS sandbox
            </span>
          </div>
        </header>
        <main key={loc.pathname} className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
