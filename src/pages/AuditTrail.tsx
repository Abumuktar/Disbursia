import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Link2, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAppState, verifyChain, type ChainCheck } from '../lib/store';
import { logEvent } from '../lib/actions';
import { dateTime, num } from '../lib/format';
import { download, toCsv } from '../lib/parse';
import type { AuditEntry } from '../lib/types';
import { Alert, Badge, Button, Card, Input, Modal, PageHeader, Pagination, Select, cx } from '../components/ui';

const PAGE = 40;
const tone = (a: string): 'green' | 'yellow' | 'red' | 'gray' | 'blue' =>
  /FAILED|REJECT|CANCEL/.test(a) ? 'red' : /SIGNED|COMPLETED|VERIFIED|AUTHORIZED/.test(a) ? 'green' : /OTP|SUBMITTED|ACCEPTED|EXCLUDED/.test(a) ? 'yellow' : /LOGIN|LOGOUT/.test(a) ? 'gray' : 'blue';

export default function AuditTrail() {
  const audit = useAppState((s) => s.audit);
  const batches = useAppState((s) => s.batches);
  const users = useAppState((s) => s.users);
  const [params, setParams] = useSearchParams();
  const entity = params.get('entity') ?? '';
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [page, setPage] = useState(0);
  const [check, setCheck] = useState<ChainCheck | null>(null);
  const [open, setOpen] = useState<AuditEntry | null>(null);

  const actions = useMemo(() => [...new Set(audit.map((a) => a.action))].sort(), [audit]);
  const list = useMemo(() => {
    const ql = q.toLowerCase();
    return audit.filter((e) => (!entity || e.entityId === entity) && (!action || e.action === action) && (!actor || e.actorId === actor)
      && (!ql || e.summary.toLowerCase().includes(ql) || e.actorName.toLowerCase().includes(ql) || e.hash.startsWith(ql))).slice().reverse();
  }, [audit, entity, action, actor, q]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const refOf = (id: string) => batches.find((b) => b.id === id)?.reference;

  const runCheck = () => {
    const r = verifyChain(audit);
    setCheck(r);
    logEvent('AUDIT_CHAIN_VERIFIED', 'audit', 'chain', r.ok ? `Integrity check passed across ${r.checked} entries` : `Integrity check FAILED: ${r.reason}`);
  };
  const exportCsv = () => {
    download(`disbursia_audit_${new Date().toISOString().slice(0, 10)}.csv`, toCsv([
      ['seq', 'timestamp', 'actor', 'role', 'action', 'entity', 'entity_id', 'summary', 'before', 'after', 'prev_hash', 'hash'],
      ...list.map((e) => [e.seq, e.at, e.actorName, e.role, e.action, e.entity, e.entityId, e.summary, JSON.stringify(e.before ?? ''), JSON.stringify(e.after ?? ''), e.prevHash, e.hash]),
    ]));
    logEvent('EXPORT', 'audit', 'chain', `Exported ${list.length} audit entries`);
  };

  return (
    <>
      <PageHeader eyebrow="Accountability" title="Audit trail"
        subtitle="Every action, with actor, time and prior state. Entries are SHA-256 hash-chained: changing any past entry breaks every link after it."
        actions={<>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>Export</Button>
          <Button icon={<ShieldCheck className="h-4 w-4" />} onClick={runCheck}>Verify integrity</Button>
        </>} />

      {check && (
        <div className="mb-6">
          {check.ok
            ? <Alert tone="green" title="Hash chain intact" icon={<ShieldCheck className="h-4 w-4" />}>All {num(check.checked)} entries recomputed and linked from the genesis entry. No gaps, no alterations.</Alert>
            : <Alert tone="red" title="Integrity failure" icon={<ShieldAlert className="h-4 w-4" />}>{check.reason}</Alert>}
        </div>
      )}

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search summary, actor or hash prefix" className="pl-9" />
          </div>
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }} className="w-auto" aria-label="Action">
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </Select>
          <Select value={actor} onChange={(e) => { setActor(e.target.value); setPage(0); }} className="w-auto" aria-label="Actor">
            <option value="">All actors</option>
            <option value="system">Disbursia (system)</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          {entity && <Button variant="secondary" size="sm" onClick={() => setParams({})}>Batch {refOf(entity)} ✕</Button>}
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>#</th><th>Time</th><th>Actor</th><th>Action</th><th>Summary</th><th>Record</th><th>Hash</th></tr></thead>
            <tbody>
              {list.slice(page * PAGE, (page + 1) * PAGE).map((e) => (
                <tr key={e.seq} className="cursor-pointer" onClick={() => setOpen(e)}>
                  <td className="font-mono text-xs text-slate-400">{e.seq}</td>
                  <td className="text-xs text-slate-600">{dateTime(e.at)}</td>
                  <td><p className="text-[13px] font-medium text-slate-800">{e.actorName}</p><p className="text-[11px] capitalize text-slate-400">{e.role}</p></td>
                  <td><Badge tone={tone(e.action)}>{e.action.replace(/_/g, ' ')}</Badge></td>
                  <td className="max-w-[420px] truncate text-[13px] text-slate-600" title={e.summary}>{e.summary}</td>
                  <td>{e.entity === 'batch' ? <Link onClick={(ev) => ev.stopPropagation()} to={`/batches/${e.entityId}`} className="font-mono text-xs text-brand-700 hover:underline">{refOf(e.entityId)}</Link> : <span className="text-xs text-slate-400">{e.entity}</span>}</td>
                  <td className="font-mono text-[11px] text-slate-400">{e.hash.slice(0, 10)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={list.length} pageSize={PAGE} onPage={setPage} />
      </Card>

      <Modal open={!!open} onClose={() => setOpen(null)} width="max-w-2xl" title={open ? `Entry #${open.seq} · ${open.action.replace(/_/g, ' ')}` : ''} subtitle={open ? `${open.actorName} · ${dateTime(open.at)}` : ''}>
        {open && (
          <div className="space-y-5 text-sm">
            <p className="text-slate-700">{open.summary}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <StateBox title="Prior state" data={open.before} tone="gray" />
              <StateBox title="New state" data={open.after} tone="green" />
            </div>
            <div className="space-y-2 rounded-lg bg-slate-900 p-4 font-mono text-[11px] text-slate-300">
              <p><span className="text-slate-500">prev </span>{open.prevHash}</p>
              <p className="flex items-center gap-1 text-slate-500"><Link2 className="h-3 w-3" /> sha256(seq, time, actor, action, record, summary, before, after, prev)</p>
              <p><span className="text-slate-500">hash </span><span className="text-gold-300">{open.hash}</span></p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function StateBox({ title, data, tone }: { title: string; data: Record<string, unknown> | null; tone: 'gray' | 'green' }) {
  return (
    <div className={cx('rounded-lg border p-3', tone === 'green' ? 'border-brand-200 bg-brand-50/50' : 'border-slate-200 bg-slate-50')}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {data ? (
        <dl className="space-y-1">
          {Object.entries(data).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 text-xs"><dt className="text-slate-500">{k}</dt><dd className="truncate font-mono text-slate-800">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></div>
          ))}
        </dl>
      ) : <p className="text-xs text-slate-400">None</p>}
    </div>
  );
}
