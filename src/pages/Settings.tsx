import { useState } from 'react';
import { Fingerprint, KeyRound, Landmark, ScanFace, ShieldCheck } from 'lucide-react';
import { useAppState } from '../lib/store';
import { bankName } from '../lib/banks';
import { naira } from '../lib/format';
import { ActionError, resetSecurity } from '../lib/actions';
import { useMe } from '../lib/hooks';
import { Alert, Badge, Button, Card, CardHeader, Input, KV, Label, Modal, PageHeader } from '../components/ui';

export default function Settings() {
  const account = useAppState((s) => s.accounts[0]);
  const settings = useAppState((s) => s.settings);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" />
      <Card className="mb-6 overflow-hidden">
        <div className="relative bg-brand-900 px-6 py-6 text-white">
          <div className="pattern-grid absolute inset-0 opacity-40" />
          <div className="relative flex flex-wrap items-center gap-5">
            <div className="rounded-xl bg-white/10 p-3"><Landmark className="h-6 w-6 text-gold-300" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">Source account</p>
              <p className="text-xl font-bold">{account.name}</p>
              <p className="font-mono text-sm text-brand-200">{bankName(account.bankCode)} · {account.accountNumber}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs uppercase tracking-wider text-brand-300">Available balance</p>
              <p className="text-2xl font-bold tabular text-gold-300">{naira(account.balance)}</p>
            </div>
          </div>
        </div>
      </Card>
      <SecurityCard />
      <Card>
        <CardHeader title="Payment rules" />
        <dl className="grid grid-cols-1 gap-6 px-5 py-5 sm:grid-cols-3">
          <KV label="Auto-accept name match">{Math.round(settings.autoAcceptScore * 100)}% or higher</KV>
          <KV label="Block name match below">{Math.round(settings.reviewScore * 100)}%</KV>
          <KV label="Authorization">PIN + fingerprint</KV>
        </dl>
      </Card>
    </div>
  );
}

function SecurityCard() {
  const me = useMe();
  const sec = me.security;
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const factors = [
    { icon: ScanFace, label: 'Face scan', on: !!sec?.face },
    { icon: Fingerprint, label: 'Laptop fingerprint', on: !!sec?.passkey },
    { icon: KeyRound, label: '6-digit PIN', on: true },
  ];
  return (
    <Card className="mb-6">
      <CardHeader title="Sign-in security" subtitle={`${me.name} · sole administrator`}
        action={<Button variant="secondary" size="sm" onClick={() => { setOpen(true); setPin(''); setError(''); }}>Re-enroll face & fingerprint</Button>} />
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
        {factors.map((f) => (
          <div key={f.label} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <span className="rounded-lg bg-brand-50 p-2 text-brand-700"><f.icon className="h-5 w-5" /></span>
            <span className="flex-1 text-sm font-medium text-slate-800">{f.label}</span>
            <Badge tone={f.on ? 'green' : 'yellow'}>{f.on ? 'Enrolled' : 'Not set'}</Badge>
          </div>
        ))}
      </div>
      <p className="flex items-center gap-1.5 border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5" />Face data and the fingerprint key stay on this device. The fingerprint itself never leaves the laptop's sensor.</p>
      <Modal open={open} onClose={() => setOpen(false)} title="Re-enroll face and fingerprint" subtitle="You will be signed out and asked to enroll again."
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" disabled={pin.length !== 6} onClick={() => { try { resetSecurity(pin); } catch (e) { setError(e instanceof ActionError ? e.message : String(e)); } }}>Reset and sign out</Button></>}>
        <Label htmlFor="reset-pin">Confirm with your PIN</Label>
        <Input id="reset-pin" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="font-mono tracking-[0.5em]" placeholder="••••••" />
        {error && <div className="mt-3"><Alert tone="red">{error}</Alert></div>}
      </Modal>
    </Card>
  );
}
