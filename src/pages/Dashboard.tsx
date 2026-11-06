import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CheckCircle2, Clock, FileStack, Send, ShieldCheck, Timer, Users, XCircle } from 'lucide-react';
import { useAppState, verifyChain } from '../lib/store';
import { batchSummary, useLookups, useMe } from '../lib/hooks';
import { dateTime, duration, naira, nairaShort, num, pct } from '../lib/format';
import { BarChart } from '../components/BarChart';
import { Badge, BatchStatusBadge, Button, Card, CardHeader, Empty, PageHeader, cx } from '../components/ui';

export default function Dashboard() {
  const me = useMe();
  const batches = useAppState((s) => s.batches);
  const audit = useAppState((s) => s.audit);
  const programmes = useAppState((s) => s.programmes);
  const { programme, user } = useLookups();

  const m = useMemo(() => {
    const since = Date.now() - 30 * 86400000;
    const done = batches.filter((b) => b.completedAt);
    const recent = done.filter((b) => new Date(b.completedAt!).getTime() >= since);
    let paid = 0, credited = 0, failed = 0, rows = 0, caught = 0;
    for (const b of recent) {
      const c = batchSummary(b);
      paid += c.paidAmount; credited += c.success; failed += c.failed;
    }
    for (const b of done) {
      const c = batchSummary(b);
      rows += c.total; caught += c.mismatch + c.invalid;
    }
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
      const v = inMonth.reduce((s, b) => s + batchSummary(b).paidAmount, 0);
      const n = inMonth.reduce((s, b) => s + batchSummary(b).success, 0);
      months.push({ label: d.toLocaleDateString('en-GB', { month: 'short' }), value: v, detail: `${num(n)} beneficiaries · ${inMonth.length} batches` });
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
  const firstName = me.name.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const maxProg = Math.max(1, ...m.byProg.map((x) => x.amount));

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        title={`${greeting}, ${firstName}`}
        subtitle="Disbursements across all programmes, authorization queue and pilot success measures."
        actions={me.role === 'officer' ? <Link to="/disburse"><Button icon={<Send className="h-4 w-4" />}>New disbursement</Button></Link>
          : me.role === 'signatory' ? <Link to="/approvals"><Button icon={<BadgeCheck className="h-4 w-4" />}>Review approvals{m.pending.length ? ` (${m.pending.length})` : ''}</Button></Link>
          : <Link to="/audit"><Button icon={<ShieldCheck className="h-4 w-4" />}>Open audit trail</Button></Link>}
      />

      {me.role === 'signatory' && m.pending.length > 0 && (
        <Link to="/approvals" className="mb-6 flex items-center gap-4 rounded-xl border border-gold-300 bg-gold-50 px-5 py-4 transition hover:bg-gold-100">
          <div className="rounded-full bg-gold-400 p-2 text-brand-950"><Clock className="h-5 w-5" /></div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gold-900">{m.pending.length} batch{m.pending.length > 1 ? 'es' : ''} awaiting your authorization</p>
            <p className="text-xs text-gold-800">{naira(m.pendingAmount)} ready to pay out once signed</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gold-700" />
        </Link>
      )}
      {me.role === 'officer' && (drafts.length > 0 || rejected.length > 0) && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {drafts.length > 0 && (
            <Link to={`/batches/${drafts[0].id}`} className="flex items-center gap-4 rounded-xl border border-gold-300 bg-gold-50 px-5 py-4 hover:bg-gold-100">
              <Clock className="h-5 w-5 text-gold-700" />
              <p className="flex-1 text-sm font-semibold text-gold-900">{drafts.length} verified draft{drafts.length > 1 ? 's' : ''} not yet submitted</p>
              <ArrowRight className="h-4 w-4 text-gold-700" />
            </Link>
          )}
          {rejected.length > 0 && (
            <Link to={`/batches/${rejected[0].id}`} className="flex items-center gap-4 rounded-xl border border-danger-200 bg-danger-50 px-5 py-4 hover:bg-danger-100">
              <XCircle className="h-5 w-5 text-danger-600" />
              <p className="flex-1 text-sm font-semibold text-danger-800">{rejected.length} batch{rejected.length > 1 ? 'es' : ''} returned by a signatory</p>
              <ArrowRight className="h-4 w-4 text-danger-600" />
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<CheckCircle2 className="h-5 w-5" />} label="Disbursed · last 30 days" value={nairaShort(m.paid)} sub={`${naira(m.paid)}`} />
        <Stat icon={<Users className="h-5 w-5" />} label="Beneficiaries credited · 30 days" value={num(m.credited)} sub={`${pct(m.successRate, 2)} first-attempt success`} />
        <Stat icon={<Clock className="h-5 w-5" />} tone="yellow" label="Awaiting authorization" value={String(m.pending.length)} sub={m.pending.length ? nairaShort(m.pendingAmount) + ' queued' : 'Queue is clear'} />
        <Stat icon={<XCircle className="h-5 w-5" />} tone="red" label="Bad accounts stopped before payment" value={num(m.caught)} sub={`${pct(m.caught / Math.max(1, m.rows), 2)} of ${num(m.rows)} rows uploaded`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Amount credited per month" subtitle="Successful NIP credits across all programmes" />
          <div className="px-5 pb-4 pt-2">
            <BarChart data={m.months} format={(v) => nairaShort(v)} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Pilot success measures" subtitle="Targets set in the concept brief" />
          <ul className="divide-y divide-slate-100">
            <Measure icon={<Timer className="h-4 w-4" />} label="Authorizing signature to credit" target="≤ 15 min" value={duration(Math.round(m.avgTime))} sub={`slowest ${duration(Math.round(m.maxTime))}`} ok={m.maxTime <= 15 * 60000} />
            <Measure icon={<Users className="h-4 w-4" />} label="Name-mismatch returns" target="< 1%" value="0.00%" sub="Mismatches are blocked before payment" ok />
            <Measure icon={<ShieldCheck className="h-4 w-4" />} label="Gaps in the audit log" target="0" value={chain.ok ? '0' : '1+'} sub={chain.ok ? `${num(chain.checked)} entries, hash chain intact` : chain.reason!} ok={chain.ok} />
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Recent batches" action={<Link to="/batches" className="text-xs font-semibold text-brand-700 hover:underline">View all</Link>} />
          {batches.length === 0 ? <Empty icon={<FileStack className="h-5 w-5" />} title="No batches yet" /> : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>Reference</th><th>Programme</th><th className="text-right">Beneficiaries</th><th className="text-right">Amount</th><th>Status</th><th>Prepared</th></tr></thead>
                <tbody>
                  {batches.filter((b) => b.status !== 'cancelled').slice(0, 7).map((b) => {
                    const c = batchSummary(b);
                    return (
                      <tr key={b.id}>
                        <td><Link to={`/batches/${b.id}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">{b.reference}</Link></td>
                        <td>{programme(b.programmeId).name}<span className="ml-1 text-xs text-slate-400">{b.period}</span></td>
                        <td className="text-right tabular">{num(c.included || c.total)}</td>
                        <td className="text-right font-medium tabular">{naira(c.paidAmount || c.includedAmount)}</td>
                        <td><BatchStatusBadge status={b.status} /></td>
                        <td className="text-xs text-slate-500">{dateTime(b.createdAt)}<br />{user(b.createdBy)?.name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="By programme · last 30 days" />
          <ul className="space-y-4 px-5 py-4">
            {m.byProg.map(({ p, amount, count }) => (
              <li key={p.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-800">{p.name}</span>
                  <span className="font-semibold tabular text-slate-900">{nairaShort(amount)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${(amount / maxProg) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{num(count)} credited · {p.agency}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function Stat({ icon, label, value, sub, tone = 'green' }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'green' | 'yellow' | 'red' }) {
  const t = { green: 'bg-brand-50 text-brand-600', yellow: 'bg-gold-50 text-gold-600', red: 'bg-danger-50 text-danger-600' }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className={cx('rounded-lg p-2', t)}>{icon}</div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 tabular">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-500 tabular">{sub}</p>}
    </Card>
  );
}

function Measure({ icon, label, target, value, sub, ok }: { icon: React.ReactNode; label: string; target: string; value: string; sub: string; ok: boolean }) {
  return (
    <li className="flex items-start gap-3 px-5 py-4">
      <div className="mt-0.5 rounded-md bg-slate-100 p-1.5 text-slate-600">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="truncate text-xs text-slate-500">{sub}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold tabular text-slate-900">{value}</p>
        <Badge tone={ok ? 'green' : 'red'} className="mt-1" icon={ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}>target {target}</Badge>
      </div>
    </li>
  );
}
