import { useEffect, useState } from 'react';
import { KeyRound, Lock, MessageSquareText, ShieldCheck } from 'lucide-react';
import type { Batch } from '../lib/types';
import { ActionError, authorizeBatch, rejectBatch, requestOtp, retryFailed } from '../lib/actions';
import { amountWords, naira, num } from '../lib/format';
import { batchSummary, useLookups } from '../lib/hooks';
import { bankShort } from '../lib/banks';
import { Alert, Button, Input, Label, Modal, Textarea } from './ui';
import { toast } from './toast';

export function AuthorizeModal({ batch, open, onClose, mode = 'authorize' }: { batch: Batch; open: boolean; onClose: () => void; mode?: 'authorize' | 'retry' }) {
  const { programme, account } = useLookups();
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setPin(''); setOtp(''); setSent(null); setError(''); } }, [open]);
  const c = batchSummary(batch);
  const amount = mode === 'retry' ? c.failedAmount : c.includedAmount;
  const count = mode === 'retry' ? c.failed : c.included;
  const acct = account(batch.accountId);

  const send = () => {
    setError('');
    try {
      const r = requestOtp(batch.id, mode);
      setSent(r.phone);
      toast('sms', `SMS to ${r.phone}`, <>Disbursia OTP <b className="font-mono text-base tracking-widest text-slate-900">{r.code}</b> to {mode === 'retry' ? 're-run failed payments on' : 'authorize'} {batch.reference} ({naira(amount)}). Expires in 5 minutes. Do not share.</>);
    } catch (e) { setError(e instanceof ActionError ? e.message : String(e)); }
  };

  const confirm = async () => {
    setError(''); setBusy(true);
    await new Promise((r) => setTimeout(r, 450));
    try {
      if (mode === 'retry') retryFailed(batch.id, pin, otp); else authorizeBatch(batch.id, pin, otp);
      const last = mode === 'authorize' && batch.signatures.length + 1 < batch.requiredSignatures;
      toast('success', mode === 'retry' ? 'Re-run authorized' : last ? 'Signature recorded' : 'Batch authorized', last ? 'A second signatory must now authorize this batch.' : 'Payments are being sent through NIP.');
      onClose();
    } catch (e) { setError(e instanceof ActionError ? e.message : String(e)); setOtp(''); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === 'retry' ? 'Re-run failed payments' : 'Authorize disbursement'} subtitle={`${batch.reference} · ${programme(batch.programmeId).name}`}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={confirm} loading={busy} disabled={pin.length !== 4 || otp.length !== 6} icon={<ShieldCheck className="h-4 w-4" />}>{mode === 'retry' ? 'Authorize re-run' : 'Authorize payment'}</Button>
      </>}>
      <div className="rounded-xl bg-brand-900 p-5 text-white">
        <p className="text-xs uppercase tracking-wider text-gold-300">You are authorizing</p>
        <p className="mt-1 text-3xl font-bold tabular">{naira(amount)}</p>
        <p className="mt-1 text-xs italic text-brand-200">{amountWords(amount)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-xs">
          <div><p className="text-brand-300">Beneficiaries</p><p className="font-semibold">{num(count)}</p></div>
          <div><p className="text-brand-300">From</p><p className="truncate font-semibold">{acct.name} · {bankShort(acct.bankCode)}</p></div>
        </div>
      </div>
      {mode === 'authorize' && batch.requiredSignatures > 1 && (
        <p className="mt-3 text-xs text-slate-500">This batch is above ₦50 million and needs two signatories. You will be signatory {batch.signatures.length + 1} of {batch.requiredSignatures}.</p>
      )}
      <div className="mt-5 space-y-4">
        <div>
          <Label htmlFor="auth-pin">1. Your transaction PIN</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="auth-pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="pl-9 font-mono tracking-[0.5em]" placeholder="••••" autoFocus />
          </div>
        </div>
        <div>
          <Label htmlFor="auth-otp">2. One-time password</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="auth-otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="pl-9 font-mono tracking-[0.4em]" placeholder="000000" disabled={!sent} />
            </div>
            <Button variant="secondary" onClick={send} icon={<MessageSquareText className="h-4 w-4" />}>{sent ? 'Resend' : 'Send OTP'}</Button>
          </div>
          {sent && <p className="mt-1.5 text-xs text-slate-500">Sent by SMS to {sent}. Valid for 5 minutes.</p>}
        </div>
        {error && <Alert tone="red">{error}</Alert>}
      </div>
    </Modal>
  );
}

export function RejectModal({ batch, open, onClose }: { batch: Batch; open: boolean; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setPin(''); setReason(''); setError(''); } }, [open]);
  const confirm = () => {
    try { rejectBatch(batch.id, pin, reason); toast('success', 'Batch returned to officer'); onClose(); }
    catch (e) { setError(e instanceof ActionError ? e.message : String(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Reject batch" subtitle={batch.reference}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={confirm} disabled={pin.length !== 4}>Reject batch</Button></>}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="rej-reason">Reason</Label>
          <Textarea id="rej-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: amounts for Daura LGA do not match the approved nominal roll." />
        </div>
        <div>
          <Label htmlFor="rej-pin">Your PIN</Label>
          <Input id="rej-pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="font-mono tracking-[0.5em]" placeholder="••••" />
        </div>
        {error && <Alert tone="red">{error}</Alert>}
      </div>
    </Modal>
  );
}
