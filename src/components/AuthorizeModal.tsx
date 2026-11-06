import { useEffect, useState } from 'react';
import { Fingerprint, KeyRound, Lock, MessageSquareText, ShieldCheck } from 'lucide-react';
import type { Batch } from '../lib/types';
import { ActionError, authorizeBatch, logEvent, rejectBatch, requestOtp, retryFailed, updateFingerprintCounter } from '../lib/actions';
import { biometricError, verifyFingerprint } from '../lib/biometrics';
import { amountWords, naira, num } from '../lib/format';
import { batchSummary, useLookups, useMe } from '../lib/hooks';
import { bankShort } from '../lib/banks';
import { Alert, Button, Input, Label, Modal, Textarea } from './ui';
import { toast } from './toast';

export function AuthorizeModal({ batch, open, onClose, mode = 'authorize' }: { batch: Batch; open: boolean; onClose: () => void; mode?: 'authorize' | 'retry' }) {
  const { programme, account } = useLookups();
  const me = useMe();
  const passkey = me.security?.passkey;
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setPin(''); setOtp(''); setSent(false); setError(''); } }, [open]);
  const c = batchSummary(batch);
  const amount = mode === 'retry' ? c.failedAmount : c.includedAmount;
  const count = mode === 'retry' ? c.failed : c.included;
  const acct = account(batch.accountId);

  const send = () => {
    setError('');
    try {
      const r = requestOtp(batch.id, mode);
      setSent(true);
      toast('sms', 'One-time password', <>Disbursia OTP <b className="font-mono text-base tracking-widest text-slate-900">{r.code}</b> to {mode === 'retry' ? 're-run failed payments on' : 'authorize'} {batch.reference} ({naira(amount)}). Expires in 5 minutes.</>);
    } catch (e) { setError(e instanceof ActionError ? e.message : String(e)); }
  };

  const done = () => {
    toast('success', mode === 'retry' ? 'Re-run authorized' : 'Batch authorized', 'Payments are being sent through NIP.');
    onClose();
  };

  const confirm = async () => {
    setError(''); setBusy(true);
    try {
      if (passkey) {
        const { signCount } = await verifyFingerprint(passkey);
        updateFingerprintCounter(signCount);
        if (mode === 'retry') retryFailed(batch.id, pin, { kind: 'fingerprint' }); else authorizeBatch(batch.id, pin, { kind: 'fingerprint' });
      } else {
        await new Promise((r) => setTimeout(r, 400));
        if (mode === 'retry') retryFailed(batch.id, pin, { kind: 'otp', code: otp }); else authorizeBatch(batch.id, pin, { kind: 'otp', code: otp });
      }
      done();
    } catch (e) {
      setError(e instanceof ActionError ? e.message : biometricError(e));
      if (!(e instanceof ActionError)) logEvent('AUTH_FAILED', 'batch', batch.id, `Authorization fingerprint check failed: ${biometricError(e)}`);
      setOtp('');
    } finally { setBusy(false); }
  };

  const ready = pin.length === 6 && (passkey || otp.length === 6);
  return (
    <Modal open={open} onClose={onClose} title={mode === 'retry' ? 'Re-run failed payments' : 'Authorize disbursement'} subtitle={`${batch.reference} · ${programme(batch.programmeId).name}`}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={confirm} loading={busy} disabled={!ready} icon={passkey ? <Fingerprint className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}>
          {passkey ? 'Confirm with fingerprint' : mode === 'retry' ? 'Authorize re-run' : 'Authorize payment'}
        </Button>
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
      <div className="mt-5 space-y-4">
        <div>
          <Label htmlFor="auth-pin">1. Your 6-digit PIN</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="auth-pin" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="pl-9 font-mono tracking-[0.5em]" placeholder="••••••" autoFocus />
          </div>
        </div>
        {passkey ? (
          <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3">
            <Fingerprint className="h-8 w-8 shrink-0 text-brand-700" />
            <p className="text-sm text-slate-700"><span className="font-semibold">2. Fingerprint.</span> After your PIN, touch your laptop's fingerprint sensor when prompted.</p>
          </div>
        ) : (
          <div>
            <Label htmlFor="auth-otp">2. One-time password</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="auth-otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="pl-9 font-mono tracking-[0.4em]" placeholder="000000" disabled={!sent} />
              </div>
              <Button variant="secondary" onClick={send} icon={<MessageSquareText className="h-4 w-4" />}>{sent ? 'Resend' : 'Get code'}</Button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">No fingerprint is enrolled, so a one-time code is used instead.</p>
          </div>
        )}
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
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={confirm} disabled={pin.length !== 6}>Reject batch</Button></>}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="rej-reason">Reason</Label>
          <Textarea id="rej-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: amounts for Daura LGA do not match the approved nominal roll." />
        </div>
        <div>
          <Label htmlFor="rej-pin">Your PIN</Label>
          <Input id="rej-pin" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="font-mono tracking-[0.5em]" placeholder="••••••" />
        </div>
        {error && <Alert tone="red">{error}</Alert>}
      </div>
    </Modal>
  );
}
