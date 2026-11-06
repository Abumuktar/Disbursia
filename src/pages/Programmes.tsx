import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Landmark, Users } from 'lucide-react';
import { useAppState } from '../lib/store';
import { batchSummary } from '../lib/hooks';
import { bankName } from '../lib/banks';
import { dateOnly, naira, nairaShort, num } from '../lib/format';
import { BatchStatusBadge, Card, CardHeader, KV, PageHeader } from '../components/ui';

export default function Programmes() {
  const programmes = useAppState((s) => s.programmes);
  const batches = useAppState((s) => s.batches);
  const account = useAppState((s) => s.accounts[0]);
  const settings = useAppState((s) => s.settings);

  const stats = useMemo(() => programmes.map((p) => {
    const pb = batches.filter((b) => b.programmeId === p.id && b.status !== 'cancelled');
    const paid = pb.reduce((s, b) => s + batchSummary(b).paidAmount, 0);
    const credited = pb.reduce((s, b) => s + batchSummary(b).success, 0);
    return { p, paid, credited, last: pb[0] };
  }), [programmes, batches]);
  const debited = stats.reduce((s, x) => s + x.paid, 0);

  return (
    <>
      <PageHeader eyebrow="Configuration" title="Programmes & account" subtitle="The programmes Disbursia pays and the single source account every payment is debited from." />

      <Card className="mb-6 overflow-hidden">
        <div className="relative bg-brand-900 px-6 py-6 text-white">
          <div className="pattern-grid absolute inset-0 opacity-40" />
          <div className="relative flex flex-wrap items-center gap-6">
            <div className="rounded-xl bg-white/10 p-3"><Landmark className="h-7 w-7 text-gold-300" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">Sole source account</p>
              <p className="text-2xl font-bold">{account.name}</p>
              <p className="font-mono text-sm text-brand-200">{bankName(account.bankCode)} · NUBAN {account.accountNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-brand-300">Available balance</p>
              <p className="text-3xl font-bold tabular text-gold-300">{naira(account.balance)}</p>
              <p className="text-xs text-brand-300">{nairaShort(debited)} disbursed through Disbursia</p>
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-6 px-6 py-5 sm:grid-cols-3">
          <KV label="Second signatory required above">{naira(settings.secondSignatoryThreshold)}</KV>
          <KV label="Auto-accept name match at">{Math.round(settings.autoAcceptScore * 100)}% or higher</KV>
          <KV label="Block name match below">{Math.round(settings.reviewScore * 100)}%</KV>
        </dl>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {stats.map(({ p, paid, credited, last }) => (
          <Card key={p.id}>
            <CardHeader title={<span className="flex items-center gap-2"><span className="rounded bg-gold-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-gold-800">{p.code}</span>{p.name}</span>}
              subtitle={<span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{p.agency}</span>} />
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600">{p.description}</p>
              <dl className="mt-4 grid grid-cols-3 gap-4">
                <KV label="Enrolled"><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-slate-400" />{num(p.enrolled)}</span></KV>
                <KV label="Paid to date">{nairaShort(paid)}</KV>
                <KV label="Credits">{num(credited)}</KV>
              </dl>
              {last && (
                <Link to={`/batches/${last.id}`} className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs hover:bg-slate-100">
                  <span className="text-slate-500">Latest: <span className="font-mono text-slate-700">{last.reference}</span> · {dateOnly(last.createdAt)}</span>
                  <BatchStatusBadge status={last.status} />
                </Link>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
