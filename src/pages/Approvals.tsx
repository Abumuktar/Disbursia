import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAppState } from '../lib/store';
import { batchSummary, useLookups, useMe } from '../lib/hooks';
import { canSign } from '../lib/actions';
import { dateTime, naira, num } from '../lib/format';
import type { Batch } from '../lib/types';
import { AuthorizeModal } from '../components/AuthorizeModal';
import { Badge, BatchStatusBadge, Button, Card, Empty, PageHeader } from '../components/ui';

export default function Approvals() {
  const me = useMe();
  const batches = useAppState((s) => s.batches);
  const { programme, user } = useLookups();
  const [active, setActive] = useState<Batch | null>(null);
  const queue = useMemo(() => batches.filter((b) => b.status === 'pending_authorization' || b.status === 'awaiting_second_signature'), [batches]);
  const recent = useMemo(() => batches.filter((b) => b.signatures.some((s) => s.userId === me.id)).slice(0, 6), [batches, me.id]);
  const live = active ? batches.find((b) => b.id === active.id) ?? null : null;

  return (
    <>
      <PageHeader eyebrow="Authorization" title="Approvals" subtitle="Verified batches waiting for your PIN and fingerprint." />
      {queue.length === 0 ? (
        <Card><Empty icon={<CheckCircle2 className="h-5 w-5" />} title="Nothing awaiting authorization">Batches appear here once they are verified and submitted.</Empty></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {queue.map((b) => {
            const c = batchSummary(b);
            const p = programme(b.programmeId);
            const can = canSign(me, b);
            return (
              <Card key={b.id} className="flex flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">{p.name} · {b.period}</p>
                    <Link to={`/batches/${b.id}`} className="mt-0.5 block font-mono text-sm font-semibold text-slate-900 hover:text-brand-700">{b.reference}</Link>
                  </div>
                  <BatchStatusBadge status={b.status} />
                </div>
                <div className="grid flex-1 grid-cols-3 gap-4 px-5 py-4">
                  <div className="col-span-3 sm:col-span-1">
                    <p className="text-xs text-slate-500">Amount</p>
                    <p className="text-lg font-bold tabular text-slate-900">{naira(c.includedAmount)}</p>
                  </div>
                  <div><p className="text-xs text-slate-500">Beneficiaries</p><p className="text-lg font-bold tabular">{num(c.included)}</p></div>
                  <div><p className="text-xs text-slate-500">Held back</p><p className="text-lg font-bold tabular text-danger-600">{num(c.total - c.included)}</p></div>
                  <div className="col-span-3 flex flex-wrap gap-2 text-xs">
                    <Badge tone="green">{num(c.matched)} matched</Badge>
                    {c.review > 0 && <Badge tone="yellow">{num(c.review)} partial</Badge>}
                    {c.mismatch + c.invalid > 0 && <Badge tone="red">{num(c.mismatch + c.invalid)} blocked</Badge>}
                    <Badge tone="gray">{b.signatures.length}/{b.requiredSignatures} signatures</Badge>
                  </div>
                  <p className="col-span-3 text-xs text-slate-500">Prepared by {user(b.createdBy)?.name} · submitted {dateTime(b.submittedAt)}</p>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3">
                  <Link to={`/batches/${b.id}`} className="text-sm font-semibold text-brand-700 hover:underline">Review rows</Link>
                  {can.ok ? <Button onClick={() => setActive(b)} icon={<ShieldCheck className="h-4 w-4" />}>Authorize</Button>
                    : <span className="max-w-[60%] text-right text-xs text-slate-500">{can.reason}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {recent.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-sm font-semibold text-slate-700">Recently signed by you</h2>
          <Card className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Reference</th><th>Programme</th><th className="text-right">Amount</th><th>Your signature</th><th>Status</th></tr></thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.id}>
                    <td><Link to={`/batches/${b.id}`} className="font-mono text-[13px] text-brand-700 hover:underline">{b.reference}</Link></td>
                    <td>{programme(b.programmeId).name}</td>
                    <td className="text-right tabular">{naira(batchSummary(b).includedAmount)}</td>
                    <td className="text-xs text-slate-500"><BadgeCheck className="mr-1 inline h-3.5 w-3.5 text-brand-600" />{dateTime(b.signatures.find((s) => s.userId === me.id)?.at)}</td>
                    <td><BatchStatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
      {live && <AuthorizeModal batch={live} open onClose={() => setActive(null)} />}
    </>
  );
}
