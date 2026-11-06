import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Fingerprint, KeyRound, Lock } from 'lucide-react';
import type { Batch } from '../lib/types';
import { ActionError, authorizeBatch, checkPaymentPin, logEvent, rejectBatch, retryFailed, updateFingerprintCounter } from '../lib/actions';
import { biometricError, verifyFingerprint } from '../lib/biometrics';
import { amountWords, naira, num } from '../lib/format';
import { batchSummary, useLookups, useMe } from '../lib/hooks';
import { bankShort } from '../lib/banks';
import { Alert, Button, Input, Label, Modal, Textarea, cx } from './ui';
import { toast } from './toast';

export function AuthorizeModal({ batch, open, onClose, mode = 'authorize' }: { batch: Batch; open: boolean; onClose: () => void; mode?: 'authorize' | 'retry' }) {
  const { programme, account } = useLookups();
  const me = useMe();
  const passkey = me.security?.passkey;
  const [pin, setPin] = useState('');
  const [stage, setStage] = useState<'pin' | 'finger' | 'done'>('pin');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setPin(''); setStage('pin'); setError(''); setBusy(false); } }, [open]);
  const c = batchSummary(batch);
  const amount = mode === 'retry' ? c.failedAmount : c.includedAmount;
  const count = mode === 'retry' ? c.failed : c.included;
  const acct = account(batch.accountId);

  const confirm = async () => {
    setError(''); setBusy(true);
    try {
      checkPaymentPin(batch.id, pin);
    } catch (e) {
      setError(e instanceof ActionError ? e.message : String(e)); setPin(''); setBusy(false); return;
    }
    setStage('finger');
    try {
      const { signCount } = await verifyFingerprint(passkey!);
      updateFingerprintCounter(signCount);
      if (mode === 'retry') retryFailed(batch.id, pin, { kind: 'fingerprint' }); else authorizeBatch(batch.id, pin, { kind: 'fingerprint' });
      setStage('done');
      await new Promise((r) => setTimeout(r, 700));
      toast('success', mode === 'retry' ? 'Re-run authorized' : 'Payment authorized', 'Payments are being sent through NIP.');
      onClose();
    } catch (e) {
      const msg = e instanceof ActionError ? e.message : biometricError(e);
      if (!(e instanceof ActionError)) logEvent('AUTH_FAILED', 'batch', batch.id, `Payment fingerprint check failed: ${msg}`);
      setError(msg); setStage('pin');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} title={mode === 'retry' ? 'Re-run failed payments' : 'Authorize payment'} subtitle={`${batch.reference} · ${programme(batch.programmeId).name}`}
      footer={stage === 'pin' ? <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={confirm} loading={busy} disabled={pin.length !== 6 || !passkey} icon={<Fingerprint className="h-4 w-4" />}>Continue to fingerprint</Button>
      </> : undefined}>
      <div className="rounded-xl bg-brand-900 p-5 text-white">
        <p className="text-xs uppercase tracking-wider text-gold-300">You are authorizing</p>
        <p className="mt-1 text-3xl font-bold tabular">{naira(amount)}</p>
        <p className="mt-1 text-xs italic text-brand-200">{amountWords(amount)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-xs">
          <div><p className="text-brand-300">Beneficiaries</p><p className="font-semibold">{num(count)}</p></div>
          <div><p className="text-brand-300">From</p><p className="truncate font-semibold">{acct.name} · {bankShort(acct.bankCode)}</p></div>
        </div>
      </div>

      <ol className="mt-5 flex items-center gap-2 text-xs font-semibold">
        <li className={cx('flex items-center gap-1.5 rounded-full px-3 py-1.5', stage === 'pin' ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-700')}>
          {stage === 'pin' ? <KeyRound className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />} 1. PIN
        </li>
        <span className={cx('h-0.5 w-8 rounded-full', stage === 'pin' ? 'bg-slate-200' : 'bg-brand-500')} />
        <li className={cx('flex items-center gap-1.5 rounded-full px-3 py-1.5', stage === 'finger' ? 'bg-brand-700 text-white' : stage === 'done' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400')}>
          {stage === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Fingerprint className="h-3.5 w-3.5" />} 2. Fingerprint
        </li>
      </ol>

      {!passkey ? (
        <div className="mt-4"><Alert tone="yellow" title="Fingerprint not registered">Register your fingerprint in <Link to="/settings" className="font-semibold underline" onClick={onClose}>Settings</Link> before authorizing payments.</Alert></div>
      ) : stage === 'pin' ? (
        <div className="mt-4">
          <Label htmlFor="auth-pin">Your 6-digit PIN</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="auth-pin" type="password" inputMode="numeric" maxLength={6} value={pin} autoFocus
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter' && pin.length === 6) void confirm(); }}
              className="pl-9 font-mono tracking-[0.5em]" placeholder="••••••" />
          </div>
          <p className="mt-2 text-xs text-slate-500">Next, touch your laptop's fingerprint sensor to release the payment.</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center py-2">
          <div className="relative flex h-32 w-32 items-center justify-center">
            {stage === 'finger' && <>
              <span className="animate-ripple absolute h-24 w-24 rounded-full bg-brand-200/60" />
              <span className="animate-ripple absolute h-24 w-24 rounded-full bg-gold-200/60" style={{ animationDelay: '.9s' }} />
            </>}
            <span className={cx('relative flex h-24 w-24 items-center justify-center rounded-full shadow-lg ring-1', stage === 'done' ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-white text-brand-700 ring-slate-200')}>
              {stage === 'done' ? <Check className="animate-pop h-12 w-12" strokeWidth={2.5} /> : <Fingerprint className="h-14 w-14 animate-pulse" strokeWidth={1.4} />}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-700">{stage === 'done' ? 'Fingerprint confirmed. Releasing payment…' : 'Touch your fingerprint sensor now'}</p>
        </div>
      )}
      {error && <div className="mt-4"><Alert tone="red">{error}</Alert></div>}
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
