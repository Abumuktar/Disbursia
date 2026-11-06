import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Fingerprint, KeyRound, ScanFace, ShieldCheck } from 'lucide-react';
import { useAppState } from '../lib/store';
import { ActionError, checkAdminPin, enrollSecurity, openSession, recordFactor } from '../lib/actions';
import type { Passkey } from '../lib/biometrics';
import { Crest } from '../components/Crest';
import { LogoPlate, Wordmark } from '../components/Wordmark';
import { FaceStep, FingerprintStep, PinStep } from '../components/SignInSteps';
import { cx } from '../components/ui';

type Step = 'face' | 'fingerprint' | 'pin';
const META: Record<Step, { label: string; icon: typeof ScanFace; title: string }> = {
  face: { label: 'Face', icon: ScanFace, title: 'Face scan' },
  fingerprint: { label: 'Fingerprint', icon: Fingerprint, title: 'Fingerprint' },
  pin: { label: 'PIN', icon: KeyRound, title: 'PIN' },
};

export default function Login() {
  const admin = useAppState((s) => s.users[0]);
  const setup = !admin.security;
  const steps: Step[] = useMemo(() => setup
    ? ['pin', 'face', 'fingerprint']
    : [...(admin.security?.face ? ['face' as Step] : []), ...(admin.security?.passkey ? ['fingerprint' as Step] : []), 'pin'],
  [setup, admin.security]);
  const [index, setIndex] = useState(0);
  const [enrolled, setEnrolled] = useState<{ face?: number[]; passkey?: Passkey }>({});
  const [passed, setPassed] = useState<string[]>([]);
  const [welcome, setWelcome] = useState(false);
  const step = steps[index];

  const next = (factor?: string) => {
    const done = factor ? [...passed, factor] : passed;
    setPassed(done);
    if (index + 1 < steps.length) { setIndex(index + 1); return; }
    finish(done, enrolled);
  };

  const finish = (factors: string[], profile: { face?: number[]; passkey?: Passkey }) => {
    if (setup) enrollSecurity(profile);
    setWelcome(true);
    setTimeout(() => openSession(factors), 900);
  };

  const initials = admin.name.split(' ').map((p) => p[0]).slice(0, 2).join('');

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Visual panel */}
      <section className="relative hidden overflow-hidden bg-brand-900 lg:flex">
        <div className="pattern-grid absolute inset-0 opacity-50" />
        <div className="animate-drift absolute -left-32 -top-24 h-[520px] w-[520px] rounded-full bg-brand-600/30 blur-3xl" />
        <div className="animate-drift absolute -bottom-40 -right-24 h-[460px] w-[460px] rounded-full bg-gold-400/15 blur-3xl" style={{ animationDelay: '-7s' }} />
        <div className="relative m-auto flex max-w-md flex-col items-center px-10 text-center">
          <div className="relative">
            <span className="absolute inset-0 -m-6 rounded-full border border-gold-300/20" />
            <span className="absolute inset-0 -m-12 rounded-full border border-gold-300/10" />
            <Crest className="animate-float relative h-40 w-40 drop-shadow-[0_20px_40px_rgba(0,0,0,.35)]" />
          </div>
          <LogoPlate size="text-4xl" className="mt-12 rounded-2xl px-6 pb-2.5 pt-3.5" />
          <p className="mt-6 text-lg text-brand-100">Secure disbursement for the Government of Katsina State</p>
          <div className="mt-10 flex items-center gap-3">
            {(['face', 'fingerprint', 'pin'] as Step[]).map((s, i) => {
              const I = META[s].icon;
              return (
                <div key={s} className="flex items-center gap-3">
                  {i > 0 && <span className="h-px w-6 bg-white/20" />}
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-gold-300 ring-1 ring-white/15"><I className="h-5 w-5" /></span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-brand-500 via-gold-400 to-danger-500" />
      </section>

      {/* Sign-in panel */}
      <section className="flex min-h-screen flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Home</Link>
          <div className="flex items-center gap-2 lg:hidden"><Crest className="h-8 w-8" /><Wordmark className="text-xl" /></div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
          {welcome ? (
            <div className="flex flex-col items-center text-center animate-fade-in">
              <span className="animate-pop flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg"><Check className="h-10 w-10" strokeWidth={3} /></span>
              <h1 className="mt-6 text-2xl font-bold text-slate-900">Welcome, {admin.name.split(' ')[0]}</h1>
              <p className="mt-1 text-sm text-slate-500">{setup ? 'Secure sign-in is set up' : 'Identity confirmed'}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-400 text-lg font-bold text-brand-950 shadow-sm">{initials}</span>
                <h1 className="mt-4 text-xl font-bold text-slate-900">{admin.name}</h1>
                <p className="text-sm text-slate-500">{setup ? 'Set up secure sign-in' : 'Administrator'}</p>
              </div>

              <ol className="mt-8 flex items-center justify-center gap-2" aria-label="Sign-in steps">
                {steps.map((s, i) => {
                  const I = META[s].icon;
                  const state = i < index ? 'done' : i === index ? 'active' : 'todo';
                  return (
                    <li key={s} className="flex items-center gap-2">
                      {i > 0 && <span className={cx('h-0.5 w-6 rounded-full transition-colors sm:w-10', i <= index ? 'bg-brand-500' : 'bg-slate-200')} />}
                      <span className={cx('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                        state === 'done' ? 'bg-brand-50 text-brand-700' : state === 'active' ? 'bg-brand-700 text-white shadow-sm' : 'bg-slate-100 text-slate-400')}>
                        {state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <I className="h-3.5 w-3.5" />}
                        <span className={cx(state !== 'active' && 'hidden sm:inline')}>{META[s].label}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-8 flex min-h-[380px] flex-col items-center">
                {step === 'face' && (
                  <FaceStep
                    key={`face-${index}`}
                    mode={setup ? 'enroll' : 'verify'}
                    target={admin.security?.face}
                    onDone={(r) => {
                      if (setup) setEnrolled((e) => ({ ...e, face: r.descriptor }));
                      else recordFactor('face', true, `distance ${r.distance?.toFixed(2)}`);
                      next('face');
                    }}
                    onFail={(reason) => { if (!setup) recordFactor('face', false, reason); }}
                    onSkip={setup ? () => next() : undefined}
                  />
                )}
                {step === 'fingerprint' && (
                  <FingerprintStep
                    key={`fp-${index}`}
                    mode={setup ? 'enroll' : 'verify'}
                    passkey={admin.security?.passkey}
                    user={admin}
                    onDone={(pk) => {
                      if (setup) {
                        const profile = { ...enrolled, passkey: pk };
                        setEnrolled(profile);
                        setPassed((p) => [...p, 'fingerprint']);
                        finish([...passed, 'fingerprint'], profile);
                      } else { recordFactor('fingerprint', true); next('fingerprint'); }
                    }}
                    onFail={(reason) => { if (!setup) recordFactor('fingerprint', false, reason); }}
                    onSkip={setup ? () => finish(passed, enrolled) : undefined}
                  />
                )}
                {step === 'pin' && (
                  <PinStep
                    key={`pin-${index}`}
                    label={setup ? 'Enter your PIN to begin setup' : 'Enter your 6-digit PIN'}
                    onSubmit={(pin) => {
                      try { checkAdminPin(pin); } catch (e) { throw new Error(e instanceof ActionError ? e.message : 'Incorrect PIN'); }
                      next('PIN');
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Every sign-in attempt is recorded in the audit trail
        </p>
      </section>
    </div>
  );
}
