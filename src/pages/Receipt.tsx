import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Printer, Share2 } from 'lucide-react';
import { useAppState } from '../lib/store';
import { useLookups } from '../lib/hooks';
import { logEvent } from '../lib/actions';
import { bankName } from '../lib/banks';
import { amountWords, dateTime, naira } from '../lib/format';
import { sha256 } from '../lib/sha256';
import { Crest } from '../components/Crest';
import { Wordmark } from '../components/Wordmark';
import { Button } from '../components/ui';
import { toast } from '../components/toast';

export default function Receipt() {
  const { batchId, itemId } = useParams();
  const batch = useAppState((s) => s.batches.find((b) => b.id === batchId));
  const { programme, account } = useLookups();
  const it = batch?.items.find((i) => i.id === itemId);

  if (!batch || !it || it.pay !== 'success') {
    return <div className="p-10 text-center text-sm text-slate-600">Receipt not available. <Link to="/batches" className="text-brand-700 underline">Back to batches</Link></div>;
  }
  const acct = account(batch.accountId);
  const prog = programme(batch.programmeId);
  const code = sha256([it.reference, it.sessionId, it.accountNumber, it.amount, it.paidAt].join('|')).slice(0, 20).toUpperCase().match(/.{1,4}/g)!.join('-');

  const share = async () => {
    const text = `Katsina State Government payment receipt\n${naira(it.amount)} to ${it.resolvedName} (${bankName(it.bankCode)} ${it.accountNumber})\nRef: ${it.reference}\nSession ID: ${it.sessionId}\nDate: ${dateTime(it.paidAt)}\nVerification: ${code}`;
    try {
      if (navigator.share) await navigator.share({ title: `Receipt ${it.reference}`, text });
      else { await navigator.clipboard.writeText(text); toast('success', 'Receipt details copied'); }
      logEvent('RECEIPT_SHARED', 'batch', batch.id, `Shared receipt ${it.reference}`);
    } catch { /* user cancelled */ }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3">
        <Link to={`/batches/${batch.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> {batch.reference}</Link>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Share2 className="h-4 w-4" />} onClick={share}>Share</Button>
          <Button size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => { logEvent('RECEIPT_PRINTED', 'batch', batch.id, `Printed receipt ${it.reference}`); window.print(); }}>Print / save PDF</Button>
        </div>
      </div>

      <article className="print-area relative mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]"><Crest className="h-[420px] w-[420px]" /></div>
        <header className="relative bg-brand-700 px-8 py-6 text-white">
          <div className="flex items-center gap-5">
            <Crest className="h-20 w-20 shrink-0 rounded-full bg-white p-1" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">Government of Katsina State</p>
              <p className="text-xl font-bold">Office of the Accountant-General</p>
              <p className="text-sm text-brand-100">Katsina State Secretariat, Katsina</p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold uppercase tracking-wider text-gold-300">Payment receipt</p>
              <p className="mt-1 font-mono text-xs text-brand-100">{it.reference}</p>
            </div>
          </div>
        </header>
        <div className="h-1.5 bg-gold-400" />

        <div className="relative px-8 py-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Amount credited</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight text-slate-900 tabular">{naira(it.amount)}</p>
              <p className="mt-1 max-w-md text-sm italic text-slate-500">{amountWords(it.amount)}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700 ring-1 ring-brand-600/20">
              <CheckCircle2 className="h-5 w-5" /> SUCCESSFUL
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <Section title="Beneficiary">
              <F k="Account name" v={it.resolvedName ?? it.submittedName} strong />
              <F k="Account number" v={it.accountNumber} mono />
              <F k="Bank" v={bankName(it.bankCode)} />
              {it.beneficiaryId && <F k="Beneficiary ID" v={it.beneficiaryId} mono />}
            </Section>
            <Section title="Sender">
              <F k="Account name" v={acct.name} strong />
              <F k="Account number" v={acct.accountNumber} mono />
              <F k="Bank" v={bankName(acct.bankCode)} />
              <F k="On behalf of" v="Government of Katsina State" />
            </Section>
          </div>

          <Section title="Transaction" className="mt-6">
            <div className="grid gap-x-6">
              <F k="Transaction reference" v={it.reference!} mono />
              <F k="NIP session ID" v={it.sessionId!} mono />
              <F k="Date & time" v={dateTime(it.paidAt)} />
              <F k="Channel" v="NIBSS Instant Payment (NIP)" />
              <F k="Programme" v={`${prog.name} · ${batch.period}`} />
              <F k="Batch" v={batch.reference} mono />
              <F k="Narration" v={batch.narration} />
            </div>
          </Section>

          <Section title="Authorized by" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {batch.signatures.map((s) => (
                <div key={s.userId} className="rounded-lg border border-slate-200 px-4 py-3">
                  <p className="font-serif text-lg italic text-brand-800">{s.name}</p>
                  <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.title}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Signed with PIN + OTP · {dateTime(s.at)}</p>
                </div>
              ))}
            </div>
          </Section>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-gold-400 bg-gold-50/60 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-800">Verification code</p>
              <p className="font-mono text-base font-bold tracking-wider text-slate-900">{code}</p>
            </div>
            <p className="max-w-sm text-xs text-slate-600">Quote this code and the transaction reference to the Office of the Accountant-General to confirm this receipt is genuine.</p>
          </div>
        </div>
        <footer className="relative flex flex-wrap justify-between gap-2 border-t border-slate-100 bg-slate-50 px-8 py-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-2">Generated by <Wordmark className="text-[13px]" /> · {dateTime(new Date().toISOString())}</span>
          <span>This is a system-generated receipt and does not require a physical signature.</span>
        </footer>
      </article>
    </div>
  );
}

function Section({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h3 className="mb-2 border-b border-slate-200 pb-1.5 text-xs font-bold uppercase tracking-wider text-brand-700">{title}</h3>
      {children}
    </section>
  );
}
function F({ k, v, mono, strong }: { k: string; v: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-slate-500">{k}</span>
      <span className={`text-right ${mono ? 'font-mono text-[13px] [overflow-wrap:anywhere]' : ''} ${strong ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{v}</span>
    </div>
  );
}
