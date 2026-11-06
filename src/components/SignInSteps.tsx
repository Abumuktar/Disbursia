import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Fingerprint, Loader2, RotateCcw, X } from 'lucide-react';
import {
  FACE_MATCH_THRESHOLD, averageDescriptor, biometricError, faceDistance, fingerprintSupport, loadFaceModels, readFace,
  registerFingerprint, startCamera, stopCamera, verifyFingerprint, type Passkey,
} from '../lib/biometrics';
import { updateFingerprintCounter } from '../lib/actions';
import { cx } from './ui';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Phase = 'loading' | 'scanning' | 'success' | 'error';

function StatusLine({ phase, children }: { phase: Phase; children: React.ReactNode }) {
  return (
    <p className={cx('mt-6 min-h-[1.5rem] text-center text-sm font-medium transition-colors',
      phase === 'success' ? 'text-brand-700' : phase === 'error' ? 'text-danger-600' : 'text-slate-600')} aria-live="polite">
      {children}
    </p>
  );
}

// ---- Face ------------------------------------------------------------------

export function FaceStep({ mode, target, onDone, onFail, onSkip }: {
  mode: 'enroll' | 'verify';
  target?: number[];
  onDone: (result: { descriptor?: number[]; distance?: number }) => void;
  onFail?: (reason: string) => void;
  onSkip?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef({ onDone, onFail });
  cb.current = { onDone, onFail };
  const [phase, setPhase] = useState<Phase>('loading');
  const [msg, setMsg] = useState('Starting camera…');
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        setPhase('loading'); setProgress(0); setMsg('Starting camera…');
        stream = await startCamera(video.current!);
        if (cancelled) return;
        setMsg('Preparing face recognition…');
        await loadFaceModels();
        if (cancelled) return;
        setPhase('scanning'); setMsg('Look straight at the camera');
        const samples: Float32Array[] = [];
        let good = 0;
        const started = Date.now();
        while (!cancelled) {
          const r = await readFace(video.current!);
          if (cancelled) break;
          if (!r) {
            setMsg('Position your face inside the circle');
          } else if (mode === 'enroll') {
            samples.push(r.descriptor);
            setProgress(samples.length / 5);
            setMsg('Hold still…');
            if (samples.length >= 5) {
              setPhase('success'); setMsg('Face enrolled');
              await sleep(800);
              if (!cancelled) cb.current.onDone({ descriptor: averageDescriptor(samples) });
              break;
            }
          } else {
            const d = faceDistance(r.descriptor, target!);
            setProgress(Math.max(0.08, Math.min(1, (0.85 - d) / (0.85 - FACE_MATCH_THRESHOLD))));
            if (d < FACE_MATCH_THRESHOLD) {
              good++;
              setMsg('Matching…');
              if (good >= 2) {
                setPhase('success'); setProgress(1); setMsg('Face verified');
                await sleep(800);
                if (!cancelled) cb.current.onDone({ distance: d });
                break;
              }
            } else {
              good = 0;
              setMsg('Face not recognised yet…');
            }
          }
          if (mode === 'verify' && Date.now() - started > 15000) {
            setPhase('error'); setMsg('We could not match your face');
            cb.current.onFail?.('face did not match within 15 seconds');
            break;
          }
          await sleep(180);
        }
      } catch (e) {
        if (!cancelled) { setPhase('error'); setMsg(biometricError(e)); cb.current.onFail?.(biometricError(e)); }
      } finally {
        stopCamera(stream);
      }
    })();
    return () => { cancelled = true; stopCamera(stream); };
  }, [attempt, mode, target]);

  const R = 118, C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center animate-fade-in">
      <div className="relative h-64 w-64">
        <svg viewBox="0 0 256 256" className="absolute inset-0 -rotate-90">
          <circle cx="128" cy="128" r={R} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle cx="128" cy="128" r={R} fill="none" strokeWidth="6" strokeLinecap="round"
            stroke={phase === 'error' ? '#d12f2f' : phase === 'success' ? '#0b6e3f' : '#178a51'}
            strokeDasharray={C} strokeDashoffset={C * (1 - (phase === 'error' ? 1 : progress))}
            className="transition-[stroke-dashoffset] duration-500" />
        </svg>
        {phase === 'scanning' && (
          <svg viewBox="0 0 256 256" className="animate-spin-slow absolute inset-0">
            <circle cx="128" cy="128" r="126" fill="none" stroke="#e6b325" strokeWidth="2" strokeDasharray="4 14" />
          </svg>
        )}
        <div className="absolute inset-[14px] overflow-hidden rounded-full bg-brand-950">
          <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          {phase === 'scanning' && <div className="pointer-events-none absolute inset-x-0 h-1/3 animate-[scan_2.2s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-gold-300/25 to-transparent" />}
          {phase === 'loading' && <div className="absolute inset-0 flex items-center justify-center text-brand-200"><Loader2 className="h-8 w-8 animate-spin" /></div>}
          {phase === 'success' && <div className="absolute inset-0 flex items-center justify-center bg-brand-700/60"><span className="animate-pop rounded-full bg-white p-3 text-brand-700"><Check className="h-8 w-8" strokeWidth={3} /></span></div>}
          {phase === 'error' && <div className="absolute inset-0 flex items-center justify-center bg-danger-900/50"><span className="animate-pop rounded-full bg-white p-3 text-danger-600"><X className="h-8 w-8" strokeWidth={3} /></span></div>}
        </div>
      </div>
      <StatusLine phase={phase}>{msg}</StatusLine>
      {phase === 'error' && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button onClick={() => setAttempt((a) => a + 1)} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"><RotateCcw className="h-4 w-4" /> Try again</button>
          {onSkip && <button onClick={onSkip} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100">Continue without face</button>}
        </div>
      )}
      {phase !== 'error' && <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Camera className="h-3.5 w-3.5" /> Processed on this device only</p>}
    </div>
  );
}

// ---- Fingerprint ------------------------------------------------------------

export function FingerprintStep({ mode, passkey, user, onDone, onFail, onSkip }: {
  mode: 'enroll' | 'verify';
  passkey?: Passkey;
  user: { id: string; name: string };
  onDone: (passkey?: Passkey) => void;
  onFail?: (reason: string) => void;
  onSkip?: () => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'success' | 'error' | 'unavailable'>('idle');
  const [msg, setMsg] = useState(mode === 'enroll' ? 'Register the fingerprint sensor on this laptop' : 'Touch your laptop\'s fingerprint sensor');

  useEffect(() => {
    fingerprintSupport().then((s) => {
      if (!s.secure) { setPhase('unavailable'); setMsg('Fingerprint needs a secure connection. Open Disbursia on https:// or localhost.'); }
      else if (!s.api) { setPhase('unavailable'); setMsg('This browser does not support fingerprint sign-in. Use the latest Chrome, Edge or Safari.'); }
      else if (!s.platform) { setPhase('unavailable'); setMsg('No fingerprint sensor was found. Set up Windows Hello or Touch ID on this laptop, then reload.'); }
    });
  }, [mode]);

  const run = async () => {
    setPhase('waiting');
    setMsg(mode === 'enroll' ? 'Follow your device prompt and touch the sensor' : 'Waiting for your fingerprint…');
    try {
      if (mode === 'enroll') {
        const pk = await registerFingerprint({ id: user.id, name: user.name.toLowerCase().replace(/\s+/g, '.'), displayName: user.name });
        setPhase('success'); setMsg('Fingerprint registered');
        await sleep(800);
        onDone(pk);
      } else {
        const { signCount } = await verifyFingerprint(passkey!);
        updateFingerprintCounter(signCount);
        setPhase('success'); setMsg('Fingerprint verified');
        await sleep(800);
        onDone();
      }
    } catch (e) {
      setPhase('error'); setMsg(biometricError(e));
      onFail?.(biometricError(e));
    }
  };

  const tone = phase === 'success' ? 'text-brand-700 bg-brand-50 ring-brand-200' : phase === 'error' || phase === 'unavailable' ? 'text-danger-600 bg-danger-50 ring-danger-200' : 'text-brand-700 bg-white ring-slate-200';
  return (
    <div className="flex flex-col items-center animate-fade-in">
      <div className="relative flex h-64 w-64 items-center justify-center">
        {(phase === 'idle' || phase === 'waiting') && (
          <>
            <span className="animate-ripple absolute h-40 w-40 rounded-full bg-brand-200/60" />
            <span className="animate-ripple absolute h-40 w-40 rounded-full bg-gold-200/60" style={{ animationDelay: '.9s' }} />
          </>
        )}
        <button
          onClick={run}
          disabled={phase === 'waiting' || phase === 'success' || phase === 'unavailable'}
          className={cx('relative flex h-40 w-40 items-center justify-center rounded-full shadow-xl ring-1 transition hover:scale-[1.03] disabled:hover:scale-100', tone)}
          aria-label={mode === 'enroll' ? 'Register fingerprint' : 'Scan fingerprint'}
        >
          {phase === 'success' ? <Check className="animate-pop h-16 w-16" strokeWidth={2.5} /> : <Fingerprint className={cx('h-20 w-20', phase === 'waiting' && 'animate-pulse')} strokeWidth={1.4} />}
        </button>
      </div>
      <StatusLine phase={phase === 'success' ? 'success' : phase === 'error' || phase === 'unavailable' ? 'error' : 'scanning'}>{msg}</StatusLine>
      {phase === 'idle' && <button onClick={run} className="mt-4 rounded-xl bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">{mode === 'enroll' ? 'Register fingerprint' : 'Scan fingerprint'}</button>}
      {phase === 'error' && <button onClick={run} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"><RotateCcw className="h-4 w-4" /> Try again</button>}
      {onSkip && (phase === 'unavailable' || phase === 'error') && <button onClick={onSkip} className="mt-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">Continue without fingerprint</button>}
    </div>
  );
}

// ---- PIN -----------------------------------------------------------------------

export function PinStep({ onSubmit, label = 'Enter your 6-digit PIN' }: { onSubmit: (pin: string) => Promise<void> | void; label?: string }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  const submit = async (value: string) => {
    setBusy(true); setError('');
    await sleep(350);
    try { await onSubmit(value); }
    catch (e) { setError(e instanceof Error ? e.message : 'Incorrect PIN'); setShake((s) => s + 1); setPin(''); input.current?.focus(); }
    finally { setBusy(false); }
  };
  const press = (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, 6);
    setPin(next); setError('');
    if (next.length === 6) void submit(next);
  };

  return (
    <div className="flex flex-col items-center animate-fade-in">
      <div className="flex h-24 items-center"><span className="rounded-2xl bg-gold-50 p-4 text-gold-600 ring-1 ring-gold-200"><LockDots /></span></div>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <div key={shake} className={cx('mt-5 flex gap-2.5', shake > 0 && 'animate-shake')} onClick={() => input.current?.focus()}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={cx('flex h-14 w-11 items-center justify-center rounded-xl border-2 text-2xl font-bold transition-colors sm:w-12',
            error ? 'border-danger-300 bg-danger-50' : i < pin.length ? 'border-brand-600 bg-brand-50 text-brand-800' : i === pin.length ? 'border-gold-400 bg-white' : 'border-slate-200 bg-white')}>
            {i < pin.length ? '•' : ''}
          </span>
        ))}
      </div>
      <input
        ref={input} value={pin} inputMode="numeric" autoComplete="off" aria-label="PIN" maxLength={6}
        className="absolute h-px w-px opacity-0"
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          setPin(v); setError('');
          if (v.length === 6 && !busy) void submit(v);
        }}
        onKeyDown={(e) => { if (e.key === 'Backspace' && pin.length === 0) e.preventDefault(); }}
      />
      <p className={cx('mt-4 min-h-[1.25rem] text-center text-sm font-medium', error ? 'text-danger-600' : 'text-slate-400')} aria-live="polite">
        {busy ? <span className="inline-flex items-center gap-2 text-brand-700"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</span> : error}
      </p>
      <div className="mt-3 grid w-64 grid-cols-3 gap-2 lg:hidden">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => k === '' ? <span key={i} /> : (
          <button key={i} type="button" onClick={() => (k === '⌫' ? setPin((p) => p.slice(0, -1)) : press(k))}
            className="h-12 rounded-xl bg-slate-100 text-lg font-semibold text-slate-800 active:bg-slate-200">{k}</button>
        ))}
      </div>
    </div>
  );
}

function LockDots() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <circle cx="9" cy="15.5" r=".9" fill="currentColor" /><circle cx="12" cy="15.5" r=".9" fill="currentColor" /><circle cx="15" cy="15.5" r=".9" fill="currentColor" />
    </svg>
  );
}
