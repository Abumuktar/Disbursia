import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Layers, Plus, Users } from 'lucide-react';
import { useAppState } from '../lib/store';
import { batchSummary } from '../lib/hooks';
import { ActionError, createProgramme } from '../lib/actions';
import { dateOnly, nairaShort, num } from '../lib/format';
import { Alert, Button, Card, Empty, Input, Label, Modal, PageHeader, Textarea } from '../components/ui';
import { toast } from '../components/toast';

export default function Programmes() {
  const programmes = useAppState((s) => s.programmes);
  const batches = useAppState((s) => s.batches);
  const [adding, setAdding] = useState(false);

  const stats = useMemo(() => programmes.map((p) => {
    const pb = batches.filter((b) => b.programmeId === p.id && b.status !== 'cancelled');
    return { p, paid: pb.reduce((s, b) => s + batchSummary(b).paidAmount, 0), runs: pb.length, last: pb[0] };
  }), [programmes, batches]);

  return (
    <>
      <PageHeader title="Programmes"
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add programme</Button>} />

      {stats.length === 0 ? <Card><Empty icon={<Layers className="h-5 w-5" />} title="No programmes yet" /></Card> : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stats.map(({ p, paid, runs, last }) => (
            <Card key={p.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-lg bg-gold-50 px-2 py-1 font-mono text-xs font-bold text-gold-800 ring-1 ring-inset ring-gold-200">{p.code}</span>
                {last && <span className="text-xs text-slate-400">Last run {dateOnly(last.createdAt)}</span>}
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900">{p.name}</h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500"><Building2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{p.agency}</span></p>
              <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
                <Stat k="Enrolled" v={num(p.enrolled)} />
                <Stat k="Paid" v={nairaShort(paid)} />
                <Stat k="Runs" v={String(runs)} />
              </dl>
              <Link to={`/disburse?programme=${p.id}`} className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brand-700 hover:text-brand-800">
                New disbursement <ArrowRight className="h-4 w-4" />
              </Link>
            </Card>
          ))}
          <button onClick={() => setAdding(true)} className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700">
            <span className="rounded-full bg-white p-3 shadow-sm ring-1 ring-slate-200"><Plus className="h-5 w-5" /></span>
            <span className="mt-3 text-sm font-semibold">Add a programme</span>
          </button>
        </div>
      )}
      <AddProgramme open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div className="min-w-0"><dt className="text-[11px] uppercase tracking-wide text-slate-400">{k}</dt><dd className="mt-0.5 truncate text-sm font-semibold tabular text-slate-800">{v}</dd></div>
);

function AddProgramme({ open, onClose }: { open: boolean; onClose: () => void }) {
  const empty = { name: '', code: '', agency: '', description: '', enrolled: '', amount: '' };
  const [f, setF] = useState(empty);
  const [error, setError] = useState('');
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const close = () => { setF(empty); setError(''); onClose(); };
  const save = () => {
    try {
      const p = createProgramme({
        name: f.name, code: f.code, agency: f.agency, description: f.description,
        enrolled: Number(f.enrolled.replace(/,/g, '')), standardAmount: Math.round(Number(f.amount.replace(/,/g, '')) * 100),
      });
      toast('success', 'Programme added', `${p.name} is ready for disbursements.`);
      close();
    } catch (e) { setError(e instanceof ActionError ? e.message : String(e)); }
  };
  return (
    <Modal open={open} onClose={close} title="Add programme" subtitle="New programmes pay from the same source account."
      footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button onClick={save} icon={<Plus className="h-4 w-4" />}>Add programme</Button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
        <div><Label htmlFor="pg-name">Programme name</Label><Input id="pg-name" value={f.name} onChange={set('name')} placeholder="School Feeding Allowance" autoFocus /></div>
        <div><Label htmlFor="pg-code">Code</Label><Input id="pg-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) })} placeholder="SFA" className="font-mono uppercase" /></div>
        <div className="sm:col-span-2"><Label htmlFor="pg-agency">Ministry or agency</Label><Input id="pg-agency" value={f.agency} onChange={set('agency')} placeholder="Ministry of Education" /></div>
        <div><Label htmlFor="pg-enrolled">Beneficiaries enrolled</Label><Input id="pg-enrolled" inputMode="numeric" value={f.enrolled} onChange={(e) => setF({ ...f, enrolled: e.target.value.replace(/[^\d,]/g, '') })} placeholder="3,000" /></div>
        <div><Label htmlFor="pg-amount">Usual amount (₦)</Label><Input id="pg-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.,]/g, '') })} placeholder="20,000" /></div>
        <div className="sm:col-span-2"><Label htmlFor="pg-desc" hint="(optional)">Description</Label><Textarea id="pg-desc" rows={2} value={f.description} onChange={set('description')} placeholder="Who is paid and how often" /></div>
      </div>
      {error && <div className="mt-4"><Alert tone="red">{error}</Alert></div>}
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><Users className="h-3.5 w-3.5" />The new programme is recorded in the audit trail.</p>
    </Modal>
  );
}
