import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, FileCheck2, KeyRound, Lock, RotateCcw, ScrollText, ShieldCheck } from 'lucide-react';
import { useAppState, resetStore } from '../lib/store';
import { ActionError, login } from '../lib/actions';
import { DEMO_PINS, seedState } from '../lib/seed';
import { Crest } from '../components/Crest';
import { LogoPlate, Wordmark } from '../components/Wordmark';
import { ROLE_LABEL } from '../components/Layout';
import { Alert, Button, Input, cx } from '../components/ui';
import { toast } from '../components/toast';

const PILLARS = [
  { icon: BadgeCheck, title: 'Verify before pay', body: 'Every name confirmed against the bank record through NIBSS before a naira leaves.' },
  { icon: KeyRound, title: 'One authorized run', body: 'Thousands of payments on one PIN and OTP. Two signatories above ₦50 million.' },
  { icon: FileCheck2, title: 'A receipt per transaction', body: 'Printable, crested receipts naming sender, beneficiary and signatories.' },
  { icon: ScrollText, title: 'Immutable audit trail', body: 'Every action hash-chained with actor, time and prior state.' },
];

export default function Login() {
  const users = useAppState((s) => s.users);
  const [userId, setUserId] = useState(users[0].id);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try { login(userId, pin); } catch (err) { setError(err instanceof ActionError ? err.message : 'Sign-in failed.'); setPin(''); }
  };

  return (
    <div className="grid grid-cols-1 min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="relative hidden overflow-hidden bg-brand-900 text-white lg:flex lg:flex-col">
        <div className="pattern-grid absolute inset-0 opacity-60" />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-700/40 blur-3xl" />
        <div className="relative flex flex-1 flex-col px-14 py-12">
          <div className="flex items-center gap-4">
            <Crest className="h-16 w-16" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">Government of Katsina State</p>
              <p className="text-lg font-semibold">Office of the Accountant-General</p>
            </div>
          </div>
          <div className="mt-auto max-w-xl pb-6">
            <div className="mb-5 h-1 w-16 rounded bg-gold-400" />
            <h1><LogoPlate size="text-6xl" className="rounded-2xl px-6 pb-3 pt-4" /></h1>
            <p className="mt-4 text-lg leading-relaxed text-brand-100">
              One platform to disburse funds to thousands of beneficiaries at once: verified, authorized and receipted.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-4">
              {PILLARS.map((p) => (
                <div key={p.title} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <p.icon className="h-5 w-5 text-gold-300" />
                  <p className="mt-3 text-sm font-semibold">{p.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-brand-200">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="relative text-xs text-brand-300">Katsina State Secretariat, Katsina · Confidential, for authorized government users</p>
        </div>
        <div className="relative h-1.5 bg-gold-400" />
      </section>

      <section className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Back to home</Link>
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Crest className="h-12 w-12" />
            <div>
              <Wordmark className="text-3xl" />
              <p className="text-xs text-slate-500">Katsina State · Office of the Accountant-General</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Choose your account and enter your 4-digit PIN.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="space-y-2" role="radiogroup" aria-label="User">
              {users.map((u) => (
                <button
                  type="button"
                  key={u.id}
                  role="radio"
                  aria-checked={userId === u.id}
                  onClick={() => { setUserId(u.id); setPin(''); setError(''); }}
                  className={cx('flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                    userId === u.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50')}
                >
                  <div className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    userId === u.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600')}>
                    {u.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{u.name}</p>
                    <p className="truncate text-xs text-slate-500">{u.title}</p>
                  </div>
                  <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 sm:inline">{ROLE_LABEL[u.role].replace(' (read-only)', '')}</span>
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="pin" className="mb-1.5 block text-sm font-medium text-slate-700">PIN</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="pl-9 font-mono tracking-[0.5em]" placeholder="••••" autoFocus />
              </div>
            </div>
            {error && <Alert tone="red">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" disabled={pin.length !== 4} icon={<ShieldCheck className="h-4 w-4" />}>Sign in securely</Button>
          </form>

          <div className="mt-8 rounded-xl border border-gold-200 bg-gold-50 p-4 text-xs text-gold-900">
            <p className="font-semibold">Pilot demonstration</p>
            <p className="mt-1 leading-relaxed">
              Bank calls run against a simulated NIBSS sandbox. Demo PINs:{' '}
              {users.map((u, i) => <span key={u.id}>{i > 0 && ' · '}<b>{u.name.split(' ')[0]}</b> {DEMO_PINS[u.id]}</span>)}
            </p>
            <button type="button" onClick={async () => { await resetStore(seedState); toast('success', 'Demo data reset'); }}
              className="mt-2 inline-flex items-center gap-1 font-semibold text-gold-800 underline-offset-2 hover:underline">
              <RotateCcw className="h-3 w-3" /> Reset demo data
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
