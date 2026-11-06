import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, CheckCircle2, Download, FileText, Printer, RotateCcw, Search, Send, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { useAppState } from '../lib/store';
import { batchSummary, useLookups, useMe } from '../lib/hooks';
import { ActionError, canSign, cancelBatch, logEvent, setItemsIncluded, submitBatch } from '../lib/actions';
import { bankName, bankShort } from '../lib/banks';
import { dateTime, duration, naira, num, pct, timeSecs } from '../lib/format';
import { download, toCsv } from '../lib/parse';
import type { BatchItem } from '../lib/types';
import { AuthorizeModal, RejectModal } from '../components/AuthorizeModal';
import { Alert, BatchStatusBadge, Button, Card, CardHeader, Empty, Input, KV, PageHeader, Pagination, PayBadge, Progress, VerifyBadge, cx } from '../components/ui';
import { toast } from '../components/toast';
import { Stepper } from './NewDisbursement';

type Filter = 'all' | 'matched' | 'review' | 'mismatch' | 'invalid' | 'duplicate' | 'success' | 'failed' | 'excluded';
const PAGE = 50;

export default function BatchDetail() {
  const { id } = useParams();
  const batch = useAppState((s) => s.batches.find((b) => b.id === id));
  const audit = useAppState((s) => s.audit);
  const me = useMe();
  const { programme, account, user } = useLookups();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [authOpen, setAuthOpen] = useState<false | 'authorize' | 'retry'>(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const rows = useMemo(() => {
    if (!batch) return [];
    const ql = q.trim().toLowerCase();
    return batch.items.filter((it) => {
      if (filter === 'success' || filter === 'failed') { if (it.pay !== filter) return false; }
      else if (filter === 'excluded') { if (it.include || batch.status === 'verifying') return false; }
      else if (filter !== 'all' && it.verify !== filter) return false;
      if (!ql) return true;
      return it.accountNumber.includes(ql) || it.submittedName.toLowerCase().includes(ql) || (it.resolvedName ?? '').toLowerCase().includes(ql) || (it.beneficiaryId ?? '').toLowerCase().includes(ql) || (it.reference ?? '').toLowerCase().includes(ql);
    });
  }, [batch, filter, q]);

  const events = useMemo(() => audit.filter((e) => e.entityId === id).reverse(), [audit, id]);

  if (!batch) return <Empty icon={<FileText className="h-5 w-5" />} title="Batch not found"><Link to="/batches" className="text-brand-700 underline">Back to batches</Link></Empty>;

  const c = batchSummary(batch);
  const prog = programme(batch.programmeId);
  const acct = account(batch.accountId);
  const creator = user(batch.createdBy);
  const sign = canSign(me, batch);
  const isDraftOwner = (me.role === 'admin' || (me.role === 'officer' && batch.createdBy === me.id)) && batch.status === 'verified';
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE);
  const paying = ['processing', 'completed', 'completed_with_failures'].includes(batch.status);
  const step = batch.status === 'verifying' || batch.status === 'verified' ? 1 : 2;

  const act = (fn: () => void, ok: string) => { try { fn(); toast('success', ok); } catch (e) { toast('error', 'Action not completed', e instanceof ActionError ? e.message : String(e)); } };

  const exportCsv = () => {
    download(`${batch.reference}.csv`, toCsv([
      ['row', 'beneficiary_id', 'account_number', 'bank', 'name_on_file', 'name_at_bank', 'match_score', 'amount', 'verification', 'payment_status', 'transaction_reference', 'nip_session_id', 'paid_at', 'failure_reason'],
      ...batch.items.map((i) => [i.row, i.beneficiaryId ?? '', i.accountNumber, bankName(i.bankCode), i.submittedName, i.resolvedName ?? '', i.score !== undefined ? i.score.toFixed(3) : '', (i.amount / 100).toFixed(2), i.verify, i.pay ?? '', i.reference ?? '', i.sessionId ?? '', i.paidAt ?? '', i.failureReason ?? '']),
    ]));
    logEvent('EXPORT', 'batch', batch.id, `Exported ${batch.items.length} rows to CSV`);
  };

  const tabs: { key: Filter; label: string; n: number; tone?: string }[] = [
    { key: 'all', label: 'All', n: c.total },
    { key: 'matched', label: 'Matched', n: c.matched },
    { key: 'review', label: 'Partial', n: c.review, tone: 'text-gold-700' },
    { key: 'mismatch', label: 'Mismatch', n: c.mismatch, tone: 'text-danger-600' },
    { key: 'invalid', label: 'Invalid', n: c.invalid, tone: 'text-danger-600' },
    { key: 'duplicate', label: 'Duplicate', n: c.duplicate, tone: 'text-gold-700' },
    ...(paying ? [{ key: 'success' as Filter, label: 'Credited', n: c.success }, { key: 'failed' as Filter, label: 'Failed', n: c.failed, tone: 'text-danger-600' }] : []),
    { key: 'excluded', label: 'Not paid', n: batch.status === 'verifying' ? 0 : c.total - c.included },
  ];

  return (
    <>
      <Link to="/batches" className="no-print mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Batches</Link>
      <PageHeader
        eyebrow={`${prog.name} · ${batch.period}`}
        title={<span className="flex flex-wrap items-center gap-3"><span className="font-mono">{batch.reference}</span><BatchStatusBadge status={batch.status} /></span>}
        subtitle={batch.narration}
        actions={<div className="no-print flex gap-2">
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>Export CSV</Button>
          <Button variant="secondary" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => { logEvent('REPORT_PRINTED', 'batch', batch.id, 'Printed batch report'); window.print(); }}>Print report</Button>
        </div>}
      />
      {(batch.status === 'verifying' || batch.status === 'verified' || batch.status === 'pending_authorization') && <div className="no-print"><Stepper step={step} /></div>}

      {/* Status panel */}
      <div className="no-print mb-6">
        {batch.status === 'verifying' && (
          <Card className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Resolving names with NIBSS name enquiry…</p>
                <p className="text-xs text-slate-500">{num(batch.verifiedCount)} of {num(c.total)} accounts checked</p>
              </div>
              <p className="text-2xl font-bold tabular text-brand-700">{pct(batch.verifiedCount / Math.max(1, c.total), 0)}</p>
            </div>
            <Progress className="mt-4" value={batch.verifiedCount / Math.max(1, c.total)} />
          </Card>
        )}

        {batch.status === 'verified' && (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
              <Tile tone="green" label="Matched · will be paid" value={num(c.matched)} />
              <Tile tone="yellow" label="Partial / duplicate · your decision" value={num(c.review + c.duplicate)} />
              <Tile tone="red" label="Mismatch / invalid · blocked" value={num(c.mismatch + c.invalid)} />
              <Tile tone="green" label={`Included · ${num(c.included)} payments`} value={naira(c.includedAmount)} />
            </div>
            {isDraftOwner ? (
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-white px-5 py-4">
                <p className="flex-1 text-sm text-slate-600">Check the partial matches below, then submit the batch for authorization. Blocked rows are never paid.</p>
                <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => act(() => cancelBatch(batch.id), 'Draft discarded')}>Discard</Button>
                {c.review > 0 && <Button variant="secondary" size="sm" onClick={() => act(() => setItemsIncluded(batch.id, batch.items.filter((i) => i.verify === 'review').map((i) => i.id), true), 'Partial matches accepted')}>Accept all partial ({c.review})</Button>}
                <Button icon={<Send className="h-4 w-4" />} disabled={!c.included} onClick={() => act(() => submitBatch(batch.id), 'Submitted for authorization')}>Submit for authorization</Button>
              </div>
            ) : <p className="border-t border-slate-100 bg-white px-5 py-4 text-sm text-slate-500">Draft prepared by {creator?.name}. Not yet submitted for authorization.</p>}
          </Card>
        )}

        {(batch.status === 'pending_authorization' || batch.status === 'awaiting_second_signature') && (
          <Card className="overflow-hidden border-gold-300">
            <div className="flex flex-wrap items-center gap-4 bg-gold-50 px-5 py-4">
              <div className="rounded-full bg-gold-400 p-2 text-brand-950"><BadgeCheck className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gold-900">{naira(c.includedAmount)} to {num(c.included)} beneficiaries awaiting authorization</p>
                <p className="text-xs text-gold-800">Authorize with your PIN and fingerprint to release payment</p>
              </div>
              {sign.ok ? (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setRejectOpen(true)} icon={<XCircle className="h-4 w-4" />}>Reject</Button>
                  <Button onClick={() => setAuthOpen('authorize')} icon={<ShieldCheck className="h-4 w-4" />}>Authorize payment</Button>
                </div>
              ) : me.role === 'signatory' || me.role === 'admin' ? <p className="max-w-sm text-xs text-gold-900">{sign.reason}</p> : null}
            </div>
          </Card>
        )}

        {batch.status === 'processing' && (
          <Card className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Sending NIP transfers from {acct.name}…</p>
                <p className="text-xs text-slate-500">{num(c.success)} credited · {num(c.failed)} failed · {num(c.queued)} queued</p>
              </div>
              <p className="text-2xl font-bold tabular text-brand-700">{pct((c.success + c.failed) / Math.max(1, c.included), 0)}</p>
            </div>
            <Progress className="mt-4" value={(c.success + c.failed) / Math.max(1, c.included)} />
          </Card>
        )}

        {(batch.status === 'completed' || batch.status === 'completed_with_failures') && (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
              <Tile tone="green" label={`Credited · ${num(c.success)} beneficiaries`} value={naira(c.paidAmount)} />
              <Tile tone={c.failed ? 'red' : 'green'} label="Failed at destination bank" value={c.failed ? `${num(c.failed)} · ${naira(c.failedAmount)}` : 'None'} />
              <Tile tone="yellow" label="Held back before payment" value={num(c.total - c.included)} />
              <Tile tone="green" label="Signature to completion" value={batch.completedAt && batch.signatures.length ? duration(new Date(batch.payoutCompletedAt ?? batch.completedAt).getTime() - new Date(batch.signatures[batch.signatures.length - 1].at).getTime()) : '—'} />
            </div>
            {batch.status === 'completed_with_failures' && (
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-white px-5 py-4">
                <p className="flex-1 text-sm text-slate-600">Failed payments were not debited. You can re-run them once the destination banks are available.</p>
                {(me.role === 'signatory' || me.role === 'admin') && <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setAuthOpen('retry')}>Re-run {num(c.failed)} failed</Button>}
              </div>
            )}
          </Card>
        )}

        {batch.status === 'rejected' && batch.rejection && (
          <Alert tone="red" title={`Rejected by ${batch.rejection.by} on ${dateTime(batch.rejection.at)}`}>{batch.rejection.reason} Prepare a corrected schedule as a new batch.</Alert>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0">
          <div className="no-print flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex min-w-0 flex-1 basis-full flex-wrap gap-1 lg:basis-auto">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => { setFilter(t.key); setPage(0); }}
                  className={cx('rounded-md px-2.5 py-1 text-xs font-semibold transition', filter === t.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')}>
                  {t.label} <span className={cx('ml-0.5 tabular', filter === t.key ? 'text-brand-100' : t.tone ?? 'text-slate-400')}>{num(t.n)}</span>
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Name, account, ID or reference" className="py-1.5 pl-9 text-xs" />
            </div>
          </div>
          <ul className="divide-y divide-slate-100 md:hidden">
            {pageRows.map((it) => <ItemCard key={it.id} it={it} batchId={batch.id} editable={isDraftOwner} />)}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="table-base">
              <thead><tr><th>Row</th><th>Beneficiary</th><th>Account</th><th>Name at bank</th><th className="text-right">Amount</th><th>Verification</th><th>Payment</th><th className="no-print" /></tr></thead>
              <tbody>
                {pageRows.map((it) => <ItemRow key={it.id} it={it} batchId={batch.id} editable={isDraftOwner} />)}
              </tbody>
            </table>
          </div>
          {pageRows.length === 0 && <Empty icon={<Search className="h-5 w-5" />} title="No rows match this view" />}
          <Pagination page={page} pages={pages} total={rows.length} pageSize={PAGE} onPage={setPage} />
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Batch details" />
            <dl className="grid grid-cols-1 gap-4 p-5">
              <KV label="Source account">{acct.name}<span className="block font-mono text-xs font-normal text-slate-500">{bankShort(acct.bankCode)} · {acct.accountNumber}</span></KV>
              <KV label="Uploaded file">{batch.fileName}</KV>
              <KV label="Prepared by">{creator?.name}<span className="block text-xs font-normal text-slate-500">{dateTime(batch.createdAt)}</span></KV>
              <KV label="Submitted">{dateTime(batch.submittedAt)}</KV>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Authorization" subtitle={batch.signatures.length ? "Signed" : "Not yet authorized"} />
            <ul className="space-y-3 p-5">
              {Array.from({ length: batch.requiredSignatures }).map((_, i) => {
                const s = batch.signatures[i];
                return (
                  <li key={i} className="flex items-center gap-3">
                    <div className={cx('flex h-8 w-8 items-center justify-center rounded-full', s ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400')}>
                      {s ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{s ? s.name : 'Awaiting signature'}</p>
                      <p className="truncate text-xs text-slate-500">{s ? `${s.title} · ${dateTime(s.at)}` : 'PIN + fingerprint'}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card className="no-print">
            <CardHeader title="Activity" subtitle="From the audit trail" action={<Link to={`/audit?entity=${batch.id}`} className="text-xs font-semibold text-brand-700 hover:underline">Full log</Link>} />
            <ol className="relative space-y-4 p-5">
              {events.slice(0, 12).map((e) => (
                <li key={e.seq} className="flex gap-3">
                  <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', /FAILED|REJECT/.test(e.action) ? 'bg-danger-500' : /SIGNED|COMPLETED|VERIFIED/.test(e.action) ? 'bg-brand-500' : 'bg-gold-400')} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{e.action.replace(/_/g, ' ').toLowerCase().replace(/^./, (m) => m.toUpperCase())}</p>
                    <p className="text-xs text-slate-500">{e.summary}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{e.actorName} · {dateTime(e.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {authOpen && <AuthorizeModal batch={batch} open={!!authOpen} mode={authOpen} onClose={() => setAuthOpen(false)} />}
      <RejectModal batch={batch} open={rejectOpen} onClose={() => setRejectOpen(false)} />
    </>
  );
}

function ItemRow({ it, batchId, editable }: { it: BatchItem; batchId: string; editable: boolean }) {
  const decidable = editable && (it.verify === 'review' || it.verify === 'duplicate');
  const toggle = () => {
    try { setItemsIncluded(batchId, [it.id], !it.include); } catch (e) { toast('error', 'Not changed', e instanceof ActionError ? e.message : String(e)); }
  };
  return (
    <tr className={cx(!it.include && it.verify !== 'pending' && 'bg-slate-50/40')}>
      <td className="text-xs text-slate-400">{it.row}</td>
      <td>
        <p className="font-medium text-slate-800">{it.submittedName}</p>
        {it.beneficiaryId && <p className="font-mono text-[11px] text-slate-400">{it.beneficiaryId}</p>}
      </td>
      <td>
        <p className="font-mono text-[13px]">{it.accountNumber}</p>
        <p className="text-[11px] text-slate-400">{bankShort(it.bankCode)}</p>
      </td>
      <td>
        {it.resolvedName ? (
          <>
            <p className={cx('text-[13px]', it.verify === 'mismatch' ? 'text-danger-700' : 'text-slate-700')}>{it.resolvedName}</p>
            <p className="text-[11px] text-slate-400">{pct(it.score ?? 0, 0)} match</p>
          </>
        ) : <p className="text-xs text-slate-400">{it.verifyNote ?? '—'}</p>}
      </td>
      <td className="text-right font-medium tabular">{naira(it.amount)}</td>
      <td><VerifyBadge status={it.verify} /></td>
      <td>
        <PayBadge status={it.pay} />
        {it.failureReason && <p className="mt-0.5 text-[11px] text-danger-600">{it.failureReason}</p>}
        {it.pay === 'success' && <p className="mt-0.5 text-[11px] text-slate-400">{timeSecs(it.paidAt)}</p>}
      </td>
      <td className="no-print text-right">
        {decidable && (
          <Button size="sm" variant={it.include ? 'secondary' : 'gold'} onClick={toggle}>{it.include ? 'Exclude' : 'Accept'}</Button>
        )}
        {it.pay === 'success' && (
          <Link to={`/receipt/${batchId}/${it.id}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"><FileText className="h-3.5 w-3.5" /> Receipt</Link>
        )}
      </td>
    </tr>
  );
}

function ItemCard({ it, batchId, editable }: { it: BatchItem; batchId: string; editable: boolean }) {
  const decidable = editable && (it.verify === 'review' || it.verify === 'duplicate');
  const toggle = () => {
    try { setItemsIncluded(batchId, [it.id], !it.include); } catch (e) { toast('error', 'Not changed', e instanceof ActionError ? e.message : String(e)); }
  };
  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{it.submittedName}</p>
          <p className="font-mono text-xs text-slate-500">{it.accountNumber} · {bankShort(it.bankCode)}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular text-slate-900">{naira(it.amount)}</p>
      </div>
      {it.resolvedName && it.verify !== 'matched' && (
        <p className={cx('mt-1.5 text-xs', it.verify === 'mismatch' ? 'text-danger-700' : 'text-slate-600')}>Bank: {it.resolvedName} · {pct(it.score ?? 0, 0)} match</p>
      )}
      {!it.resolvedName && it.verifyNote && it.verify !== 'pending' && <p className="mt-1.5 text-xs text-danger-700">{it.verifyNote}</p>}
      {it.failureReason && <p className="mt-1.5 text-xs text-danger-600">{it.failureReason}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <VerifyBadge status={it.verify} />
        {it.pay && <PayBadge status={it.pay} />}
        <span className="ml-auto flex gap-2">
          {decidable && <Button size="sm" variant={it.include ? 'secondary' : 'gold'} onClick={toggle}>{it.include ? 'Exclude' : 'Accept'}</Button>}
          {it.pay === 'success' && <Link to={`/receipt/${batchId}/${it.id}`} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700"><FileText className="h-3.5 w-3.5" /> Receipt</Link>}
        </span>
      </div>
    </li>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: 'green' | 'yellow' | 'red' }) {
  const bar = { green: 'bg-brand-500', yellow: 'bg-gold-400', red: 'bg-danger-500' }[tone];
  return (
    <div className="relative bg-white px-5 py-4">
      <span className={cx('absolute left-0 top-4 h-8 w-1 rounded-r', bar)} />
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular text-slate-900">{value}</p>
    </div>
  );
}
