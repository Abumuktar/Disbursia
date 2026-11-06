import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BadgeCheck, CheckCircle2, ChevronRight, Clock, FileStack, Send, ShieldCheck, Timer, Users, XCircle } from 'lucide-react';
import { useAppState, verifyChain } from '../lib/store';
import { batchSummary, useLookups, useMe } from '../lib/hooks';
import { dateOnly, duration, naira, nairaShort, num, pct } from '../lib/format';
import { bankName } from '../lib/banks';
import { BarChart } from '../components/BarChart';
import { Badge, BatchStatusBadge, Button, Card, CardHeader, Empty, cx } from '../components/ui';

export default function Dashboard() {
  const me = useMe();
  const batches = useAppState((s) => s.batches);
  const audit = useAppState((s) => s.audit);
  const programmes = useAppState((s) => s.programmes);
  const account = useAppState((s) => s.accounts[0]);
  const { programme } = useLookups();

  const m = useMemo(() => {
    const since = Date.now() - 30 * 86400000;
    const done = batches.filter((b) => b.completedAt);
    const recent = done.filter((b) => new Date(b.completedAt!).getTime() >= since);
    let paid = 0, credited = 0, failed = 0, rows = 0, caught = 0;
    for (const b of recent) { const c = batchSummary(b); paid += c.paidAmount; credited += c.success; failed += c.failed; }
    for (const b of done) { const c = batchSummary(b); rows += c.total; caught += c.mismatch + c.invalid; }
    const times = done.filter((b) => b.signatures.length).map((b) => new Date(b.payoutCompletedAt ?? b.completedAt!).getTime() - new Date(b.signatures[b.signatures.length - 1].at).getTime());
    const avgTime = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const maxTime = times.length ? Math.max(...times) : 0;
    const pending = batches.filter((b) => b.status === 'pending_authorization' || b.status === 'awaiting_second_signature');
    const pendingAmount = pending.reduce((s, b) => s + batchSummary(b).includedAmount, 0);
    const months: { label: string; value: number; detail: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const inMonth = done.filter((b) => { const c = new Date(b.completedAt!); return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth(); });
      months.push({
        label: d.toLocaleDateString('en-GB', { month: 'short' }),
        value: inMonth.reduce((s, b) => s + batchSummary(b).paidAmount, 0),
        detail: `${num(inMonth.reduce((s, b) => s + batchSummary(b).success, 0))} beneficiaries · ${inMonth.length} batches`,
      });
    }
    const byProg = programmes.map((p) => {
      const pb = recent.filter((b) => b.programmeId === p.id);
      return { p, amount: pb.reduce((s, b) => s + batchSummary(b).paidAmount, 0), count: pb.reduce((s, b) => s + batchSummary(b).success, 0) };
    }).sort((a, b) => b.amount - a.amount);
    return { paid, credited, failed, rows, caught, avgTime, maxTime, pending, pendingAmount, months, byProg, successRate: credited / Math.max(1, credited + failed) };
  }, [batches, programmes]);

  const chain = useMemo(() => verifyChain(audit), [audit]);
  const drafts = batches.filter((b) => b.status === 'verified' && b.createdBy === me.id);
  const rejected = batches.filter((b) => b.status === 'rejected' && b.createdBy === me.id);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const maxProg = Math.max(1, ...m.byProg.map((x) => x.amount));
  const recentBatches = batches.filter((b) => b.status !== 'cancelled').slice(0, 6);

  const primary = me.role === 'officer' || me.role === 'admin'
    ? <Link to="/disburse"><Button icon={<Send className="h-4 w-4" />}>New disbursement</Button></Link>
    : me.role === 'signatory'
      ? <Link to="/approvals"><Button icon={<BadgeCheck className="h-4 w-4" />}>Approvals{m.pending.length ? ` (${m.pending.length})` : ''}</Button></Link>
      : <Link to="/audit"><Button icon={<ShieldCheck className="h-4 w-4" />}>Audit trail</Button></Link>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{greeting}, {me.name.split(' ')[0]}</h1>
        </div>
        {primary}
      </div>

      {/* Account overview */}
      <section className="relative overflow-hidden rounded-2xl bg-brand-900 text-white shadow-card">
        <div className="pattern-grid absolute inset-0 opacity-40" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="relative grid grid-cols-1 gap-6 p-6 sm:p-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-300">Available balance</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight tabular sm:text-4xl">{naira(account.balance)}</p>
            <p className="mt-2 text-sm text-brand-200">{account.name} · {bankName(account.bankCode)} · <span className="font-mono">{account.accountNumber}</span></p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Mini label="Paid · 30 days" value={nairaShort(m.paid)} sub={`${num(m.credited)} beneficiaries`} />
            <Mini label="Success rate" value={pct(m.successRate, 1)} sub={`${num(m.failed)} re-run`} />
            <Mini label="To sign" value={String(m.pending.length)} sub={m.pending.length ? `${nairaShort(m.pendingAmount)} queued` : 'Queue is clear'} accent={m.pending.length > 0} />
          </div>
        </div>
      </section>

      {/* Action needed */}
      {(me.role === 'signatory' || me.role === 'admin') && m.pending.length > 0 && (
        <Notice to="/approvals" tone="yellow" icon={<Clock className="h-5 w-5" />} title={`${m.pending.length} batch${m.pending.length > 1 ? 'es' : ''} awaiting your authorization`} sub={`${naira(m.pendingAmount)} ready to pay once signed`} />
      )}
      {(me.role === 'officer' || me.role === 'admin') && drafts.length > 0 && (
        <Notice to={`/batches/${drafts[0].id}`} tone="yellow" icon={<Clock className="h-5 w-5" />} title={`${drafts.length} verified draft${drafts.length > 1 ? 's' : ''} not yet submitted`} sub="Review partial matches and submit for authorization" />
      )}
      {(me.role === 'officer' || me.role === 'admin') && rejected.length > 0 && (
        <Notice to={`/batches/${rejected[0].id}`} tone="red" icon={<XCircle className="h-5 w-5" />} title={`${rejected.length} batch${rejected.length > 1 ? 'es' : ''} rejected`} sub={rejected[0].rejection?.reason ?? ''} />
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Amount credited per month" subtitle="Successful NIP credits, all programmes" />
          <div className="px-3 pb-3 pt-2 sm:px-5"><BarChart data={m.months} format={(v) => nairaShort(v)} /></div>
        </Card>
        <Card>
          <CardHeader title="Pilot success measures" subtitle="Targets from the concept brief" />
          <ul className="divide-y divide-slate-100">
            <Measure icon={<Timer className="h-4 w-4" />} label="Signature to credit" target="≤ 15 min" value={duration(Math.round(m.avgTime))} ok={m.maxTime <= 15 * 60000} />
            <Measure icon={<Users className="h-4 w-4" />} label="Mismatch returns" target="< 1%" value="0.00%" ok />
            <Measure icon={<ShieldCheck className="h-4 w-4" />} label="Audit log gaps" target="0" value={chain.ok ? '0' : '1+'} ok={chain.ok} />
          </ul>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{num(m.caught)} bad accounts stopped before payment ({pct(m.caught / Math.max(1, m.rows), 2)} of rows).</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Recent batches" action={<Link to="/batches" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">View all <ArrowUpRight className="h-3.5 w-3.5" /></Link>} />
          {recentBatches.length === 0 ? <Empty icon={<FileStack className="h-5 w-5" />} title="No batches yet" /> : (
            <ul className="divide-y divide-slate-100">
              {recentBatches.map((b) => {
                const c = batchSummary(b);
                const p = programme(b.programmeId);
                return (
                  <li key={b.id}>
                    <Link to={`/batches/${b.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50">
                      <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-50 font-mono text-[10px] font-bold text-gold-800 ring-1 ring-inset ring-gold-200 sm:flex">{p.code}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{p.name} <span className="font-normal text-slate-400">· {b.period}</span></p>
                        <p className="truncate font-mono text-xs text-slate-500">{b.reference} · {dateOnly(b.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-semibold tabular text-slate-900">{nairaShort(c.paidAmount || c.includedAmount)}</span>
                        <BatchStatusBadge status={b.status} />
                      </div>
                      <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="By programme" subtitle="Last 30 days" />
          <ul className="space-y-5 px-5 py-5">
            {m.byProg.map(({ p, amount, count }) => (
              <li key={p.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-slate-800">{p.name}</span>
                  <span className="shrink-0 font-semibold tabular text-slate-900">{nairaShort(amount)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${(amount / maxProg) * 100}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">{num(count)} credited</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Mini({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={cx('rounded-xl border px-3 py-3 backdrop-blur-sm sm:px-4', accent ? 'border-gold-300/40 bg-gold-400/10' : 'border-white/10 bg-white/5')}>
      <p className="truncate text-[11px] font-medium text-brand-200">{label}</p>
      <p className={cx('mt-1 text-lg font-bold tabular sm:text-xl', accent ? 'text-gold-300' : 'text-white')}>{value}</p>
      <p className="truncate text-[11px] text-brand-300">{sub}</p>
    </div>
  );
}

function Notice({ to, tone, icon, title, sub }: { to: string; tone: 'yellow' | 'red'; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Link to={to} className={cx('flex items-center gap-4 rounded-xl border px-5 py-4 transition',
      tone === 'yellow' ? 'border-gold-300 bg-gold-50 hover:bg-gold-100' : 'border-danger-200 bg-danger-50 hover:bg-danger-100')}>
      <span className={cx('shrink-0 rounded-full p-2', tone === 'yellow' ? 'bg-gold-400 text-brand-950' : 'bg-danger-600 text-white')}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm font-semibold', tone === 'yellow' ? 'text-gold-900' : 'text-danger-800')}>{title}</p>
        <p className={cx('truncate text-xs', tone === 'yellow' ? 'text-gold-800' : 'text-danger-700')}>{sub}</p>
      </div>
      <ArrowRight className={cx('h-4 w-4 shrink-0', tone === 'yellow' ? 'text-gold-700' : 'text-danger-600')} />
    </Link>
  );
}

function Measure({ icon, label, target, value, ok }: { icon: React.ReactNode; label: string; target: string; value: string; ok: boolean }) {
  return (
    <li className="flex items-center gap-3 px-5 py-4">
      <span className="rounded-md bg-slate-100 p-1.5 text-slate-600">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">Target {target}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-bold tabular text-slate-900">{value}</span>
        <Badge tone={ok ? 'green' : 'red'} icon={ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}>{ok ? 'On target' : 'Off'}</Badge>
      </div>
    </li>
  );
}
