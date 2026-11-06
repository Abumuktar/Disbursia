import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Download, FileSpreadsheet, Info, Sparkles, UploadCloud, X } from 'lucide-react';
import { useAppState } from '../lib/store';
import { useMe } from '../lib/hooks';
import { ActionError, createBatch } from '../lib/actions';
import { download, parseFile, toCsv, type ParseResult } from '../lib/parse';
import { generateBeneficiaries } from '../lib/sample';
import { bankName, bankShort } from '../lib/banks';
import { naira, num } from '../lib/format';
import { Alert, Button, Card, CardHeader, Input, Label, PageHeader, Select, cx } from '../components/ui';
import { toast } from '../components/toast';

const periods = () => {
  const out: string[] = [];
  const now = new Date();
  for (let i = -1; i <= 2; i++) out.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
  return out;
};

export default function NewDisbursement() {
  const me = useMe();
  const programmes = useAppState((s) => s.programmes);
  const account = useAppState((s) => s.accounts[0]);
  const threshold = useAppState((s) => s.settings.secondSignatoryThreshold);
  const nav = useNavigate();
  const [programmeId, setProgrammeId] = useState(programmes[0].id);
  const periodOptions = useMemo(periods, []);
  const [period, setPeriod] = useState(periodOptions[1]);
  const [narration, setNarration] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [sampleSize, setSampleSize] = useState(1000);
  const inputRef = useRef<HTMLInputElement>(null);
  const prog = programmes.find((p) => p.id === programmeId)!;

  if (me.role !== 'officer') {
    return <Alert tone="yellow" title="Finance officers only">Only a finance officer can prepare a disbursement batch. Signatories authorize them from Approvals.</Alert>;
  }

  const total = parsed?.rows.reduce((s, r) => s + r.amount, 0) ?? 0;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const res = await parseFile(f);
      setParsed(res);
      setFileName(f.name);
    } catch {
      toast('error', 'Could not read the file', 'Check that it is a valid .csv or .xlsx spreadsheet.');
    } finally {
      setBusy(false);
    }
  };

  const useSample = () => {
    const rows = generateBeneficiaries(prog.code, sampleSize, Date.now() % 100000, 0.004);
    setParsed({ rows, issues: [], columns: ['beneficiary_id', 'account_number', 'bank_code', 'account_name', 'amount'] });
    setFileName(`${prog.code.toLowerCase()}_${period.replace(' ', '_').toLowerCase()}_sample.csv`);
  };

  const template = () => {
    const rows = generateBeneficiaries(prog.code, 5, 42, 0);
    download('disbursia_template.csv', toCsv([
      ['beneficiary_id', 'account_number', 'bank_code', 'account_name', 'amount'],
      ...rows.map((r) => [r.beneficiaryId ?? '', r.accountNumber, r.bankCode, r.name, (r.amount / 100).toFixed(2)]),
    ]));
  };

  const verify = () => {
    if (!parsed) return;
    try {
      const id = createBatch({ programmeId, accountId: account.id, narration, period, fileName, rows: parsed.rows });
      toast('success', 'Verification started', 'Resolving every account name against NIBSS.');
      nav(`/batches/${id}`);
    } catch (e) {
      toast('error', 'Could not start verification', e instanceof ActionError ? e.message : String(e));
    }
  };

  return (
    <>
      <PageHeader eyebrow="Step 1 of 3 · Prepare" title="New disbursement" subtitle="Choose the programme, upload the beneficiary schedule and verify every account against the bank's own record before anything is paid." />
      <Stepper step={0} />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Payment details" />
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="prog">Programme</Label>
                <Select id="prog" value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
                  {programmes.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.agency}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="period">Payment period</Label>
                <Select id="period" value={period} onChange={(e) => setPeriod(e.target.value)}>
                  {periodOptions.map((p) => <option key={p}>{p}</option>)}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="narr" hint="(shown on beneficiary bank statements)">Narration</Label>
                <Input id="narr" maxLength={60} placeholder={`KTSG ${prog.name} ${period}`} value={narration} onChange={(e) => setNarration(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Source account</Label>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{account.name}</p>
                    <p className="font-mono text-xs text-slate-500">{bankName(account.bankCode)} · {account.accountNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Available</p>
                    <p className="text-sm font-bold tabular text-brand-700">{naira(account.balance)}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Beneficiary schedule" subtitle="CSV or Excel with account number, bank, account name and amount"
              action={<Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={template}>Template</Button>} />
            <div className="p-5">
              {!parsed ? (
                <>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setDrag(false); void onFile(e.dataTransfer.files[0]); }}
                    onClick={() => inputRef.current?.click()}
                    className={cx('flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition',
                      drag ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50')}
                  >
                    <div className="rounded-full bg-brand-100 p-3 text-brand-700"><UploadCloud className="h-6 w-6" /></div>
                    <p className="mt-3 text-sm font-semibold text-slate-800">{busy ? 'Reading file…' : 'Drop the spreadsheet here, or click to browse'}</p>
                    <p className="mt-1 text-xs text-slate-500">.xlsx or .csv · up to 50,000 rows</p>
                    <input ref={inputRef} type="file" accept=".csv,.xlsx,.txt" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-gold-50 px-4 py-3 text-sm ring-1 ring-inset ring-gold-200">
                    <Sparkles className="h-4 w-4 text-gold-700" />
                    <span className="flex-1 text-gold-900">No file to hand? Generate a sample {prog.name.toLowerCase()} schedule.</span>
                    <Select value={sampleSize} onChange={(e) => setSampleSize(Number(e.target.value))} className="w-auto py-1.5 text-xs" aria-label="Sample size">
                      {[200, 1000, 5000, 20000].map((n) => <option key={n} value={n}>{num(n)} rows</option>)}
                    </Select>
                    <Button size="sm" variant="gold" onClick={useSample}>Generate</Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
                    <FileSpreadsheet className="h-8 w-8 text-brand-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{fileName}</p>
                      <p className="text-xs text-slate-500">{num(parsed.rows.length)} valid rows · {naira(total)}{parsed.issues.length ? ` · ${parsed.issues.length} rejected` : ''}</p>
                    </div>
                    <button onClick={() => { setParsed(null); setFileName(''); }} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Remove file"><X className="h-4 w-4" /></button>
                  </div>
                  {parsed.issues.length > 0 && (
                    <Alert tone={parsed.rows.length ? 'yellow' : 'red'} title={`${parsed.issues.length} row${parsed.issues.length > 1 ? 's' : ''} could not be read and will not be paid`}>
                      <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-xs">
                        {parsed.issues.slice(0, 50).map((i) => <li key={i.row}>{i.row ? `Row ${i.row}: ` : ''}{i.message}</li>)}
                      </ul>
                    </Alert>
                  )}
                  {parsed.rows.length > 0 && (
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <p className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">Preview · first 6 rows</p>
                      <div className="overflow-x-auto">
                        <table className="table-base">
                          <thead><tr><th>Row</th><th>Account</th><th>Bank</th><th>Name on file</th><th className="text-right">Amount</th></tr></thead>
                          <tbody>
                            {parsed.rows.slice(0, 6).map((r) => (
                              <tr key={r.row}>
                                <td className="text-slate-400">{r.row}</td>
                                <td className="font-mono text-[13px]">{r.accountNumber}</td>
                                <td>{bankShort(r.bankCode)}</td>
                                <td>{r.name}</td>
                                <td className="text-right tabular">{naira(r.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-20 overflow-hidden">
            <div className="bg-brand-900 px-5 py-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">Batch summary</p>
              <p className="mt-2 text-3xl font-bold tabular">{naira(total)}</p>
              <p className="text-sm text-brand-200">{num(parsed?.rows.length ?? 0)} beneficiaries</p>
            </div>
            <dl className="space-y-3 px-5 py-4 text-sm">
              <Row k="Programme" v={prog.name} />
              <Row k="Period" v={period} />
              <Row k="From" v={`${account.name} (${bankShort(account.bankCode)})`} />
              <Row k="Signatures needed" v={total > threshold ? '2 (above ₦50m)' : '1'} />
            </dl>
            {total > account.balance && <div className="px-5 pb-3"><Alert tone="red">The batch exceeds the available balance.</Alert></div>}
            <div className="border-t border-slate-100 p-5">
              <Button size="lg" className="w-full" disabled={!parsed?.rows.length || busy} onClick={verify} icon={<ArrowRight className="h-4 w-4" />}>Verify with NIBSS</Button>
              <p className="mt-3 flex gap-2 text-xs text-slate-500"><Info className="h-3.5 w-3.5 shrink-0" />Nothing is paid at this step. Every name is checked first, then the batch goes to a signatory.</p>
            </div>
          </Card>
          <Card className="p-5 text-xs text-slate-600">
            <p className="mb-2 flex items-center gap-2 font-semibold text-slate-800"><AlertTriangle className="h-4 w-4 text-gold-600" /> Controls applied</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>NUBAN check digit validated for every account</li>
              <li>Duplicate accounts in the same file are held back</li>
              <li>Names scoring below 90% need an officer decision; below 70% are blocked</li>
              <li>You cannot authorize a batch you prepared</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-slate-800">{v}</dd></div>
);

export function Stepper({ step }: { step: number }) {
  const steps = ['Prepare & upload', 'Verify names', 'Authorize & pay'];
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={cx('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
            i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-gold-400 text-brand-950' : 'bg-slate-200 text-slate-500')}>{i + 1}</span>
          <span className={cx('font-medium', i === step ? 'text-slate-900' : 'text-slate-500')}>{s}</span>
          {i < steps.length - 1 && <span className="mx-2 h-px w-8 bg-slate-300" />}
        </li>
      ))}
    </ol>
  );
}
