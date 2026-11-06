import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileStack, Search, Send } from 'lucide-react';
import { useAppState } from '../lib/store';
import { batchSummary, useLookups, useMe } from '../lib/hooks';
import { dateTime, naira, num } from '../lib/format';
import type { BatchStatus } from '../lib/types';
import { BATCH_STATUS, BatchStatusBadge, Button, Card, Empty, Input, PageHeader, Select } from '../components/ui';

export default function Batches() {
  const me = useMe();
  const batches = useAppState((s) => s.batches);
  const programmes = useAppState((s) => s.programmes);
  const { programme, user } = useLookups();
  const [q, setQ] = useState('');
  const [prog, setProg] = useState('');
  const [status, setStatus] = useState<BatchStatus | ''>('');

  const list = useMemo(() => batches.filter((b) =>
    (!prog || b.programmeId === prog) && (!status || b.status === status)
    && (!q || b.reference.toLowerCase().includes(q.toLowerCase()) || b.narration.toLowerCase().includes(q.toLowerCase()))), [batches, prog, status, q]);

  return (
    <>
      <PageHeader eyebrow="Records" title="Batches & receipts" subtitle="Every disbursement batch, its verification results and a receipt for each credited payment."
        actions={me.role === 'officer' && <Link to="/disburse"><Button icon={<Send className="h-4 w-4" />}>New disbursement</Button></Link>} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <div className="relative w-full sm:w-auto sm:min-w-[220px] sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference or narration" className="pl-9" />
          </div>
          <Select value={prog} onChange={(e) => setProg(e.target.value)} className="w-full sm:w-auto" aria-label="Programme">
            <option value="">All programmes</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as BatchStatus | '')} className="w-full sm:w-auto" aria-label="Status">
            <option value="">All statuses</option>
            {(Object.keys(BATCH_STATUS) as BatchStatus[]).map((s) => <option key={s} value={s}>{BATCH_STATUS[s].label}</option>)}
          </Select>
        </div>
        {list.length === 0 ? <Empty icon={<FileStack className="h-5 w-5" />} title="No batches match these filters" /> : (<>
          <ul className="divide-y divide-slate-100 md:hidden">
            {list.map((b) => {
              const c = batchSummary(b);
              const paid = c.success > 0;
              return (
                <li key={b.id}>
                  <Link to={`/batches/${b.id}`} className="block px-4 py-3.5 active:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{programme(b.programmeId).name}</p>
                        <p className="truncate font-mono text-xs text-brand-700">{b.reference}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular text-slate-900">{naira(paid ? c.paidAmount : c.includedAmount)}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <BatchStatusBadge status={b.status} />
                      <span className="text-xs text-slate-500">{num(paid ? c.success : c.total)} {paid ? 'credited' : 'rows'} · {b.period}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="table-base">
              <thead><tr><th>Reference</th><th>Programme</th><th>Period</th><th className="text-right">Rows</th><th className="text-right">Credited</th><th className="text-right">Amount</th><th>Status</th><th>Prepared by</th></tr></thead>
              <tbody>
                {list.map((b) => {
                  const c = batchSummary(b);
                  const paid = c.success > 0;
                  return (
                    <tr key={b.id}>
                      <td><Link to={`/batches/${b.id}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">{b.reference}</Link></td>
                      <td>{programme(b.programmeId).name}</td>
                      <td className="text-slate-500">{b.period}</td>
                      <td className="text-right tabular">{num(c.total)}</td>
                      <td className="text-right tabular">{paid ? num(c.success) : '—'}</td>
                      <td className="text-right font-medium tabular">{naira(paid ? c.paidAmount : c.includedAmount)}</td>
                      <td><BatchStatusBadge status={b.status} /></td>
                      <td className="text-xs text-slate-500">{user(b.createdBy)?.name}<br />{dateTime(b.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>)}
      </Card>
    </>
  );
}
