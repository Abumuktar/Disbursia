import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Fingerprint, Loader2, RotateCcw, X } from 'lucide-react';
import {
  FACE_MATCH_THRESHOLD, averageDescriptor, biometricError, faceDistance, fingerprintSupport, loadFaceModels, readFace,
  registerFingerprint, startCamera, stopCamera, verifyFingerprint, type FaceReading, type Passkey,
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

type Pt = { x: number; y: number };
interface Scan { points: Pt[]; box: FaceReading['box']; frame: FaceReading['frame']; at: number }

// 68-point landmark model: contour runs and extra wireframe links.
const RUNS: [number, number, boolean][] = [[0, 16, false], [17, 21, false], [22, 26, false], [27, 30, false], [31, 35, false], [36, 41, true], [42, 47, true], [48, 59, true], [60, 67, true]];
const LINKS: [number, number][] = [
  [21, 27], [22, 27], [27, 39], [27, 42], [30, 31], [30, 35], [33, 51], [36, 17], [36, 0], [45, 26], [45, 16],
  [48, 4], [48, 31], [54, 12], [54, 35], [57, 8], [2, 30], [4, 30], [6, 48], [10, 54], [12, 30], [14, 30],
  [19, 37], [24, 44], [39, 31], [42, 35], [1, 36], [15, 45], [3, 31], [13, 35], [7, 58], [9, 56],
];

function drawScan(canvas: HTMLCanvasElement, scan: Scan | null, phase: Phase, t: number) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const stale = !scan || t - scan.at > 3500;
  const ok = phase === 'success', bad = phase === 'error';
  const line = ok ? 'rgba(74, 222, 128, 0.9)' : bad ? 'rgba(248, 113, 113, 0.85)' : 'rgba(110, 231, 183, 0.55)';
  const dot = ok ? '#86efac' : bad ? '#fca5a5' : '#f5dd85';

  // Background grid inside the lens
  ctx.strokeStyle = 'rgba(230, 179, 37, 0.07)';
  ctx.lineWidth = 1;
  for (let g = 0; g < W; g += 18) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(W, g); ctx.stroke(); }

  if (!scan || stale) {
    // Searching reticle
    const r = 38 + Math.sin(t / 300) * 6;
    ctx.strokeStyle = 'rgba(245, 221, 133, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 - r - 12, H / 2); ctx.lineTo(W / 2 - r + 8, H / 2); ctx.moveTo(W / 2 + r - 8, H / 2); ctx.lineTo(W / 2 + r + 12, H / 2);
    ctx.moveTo(W / 2, H / 2 - r - 12); ctx.lineTo(W / 2, H / 2 - r + 8); ctx.moveTo(W / 2, H / 2 + r - 8); ctx.lineTo(W / 2, H / 2 + r + 12); ctx.stroke();
    return;
  }

  // Map video pixels -> mirrored, object-cover canvas pixels
  const { width: vw, height: vh } = scan.frame;
  const k = Math.max(W / vw, H / vh);
  const ox = (W - vw * k) / 2, oy = (H - vh * k) / 2;
  const P = (p: Pt) => ({ x: W - (ox + p.x * k), y: oy + p.y * k });
  const pts = scan.points.map(P);
  const bx = W - (ox + (scan.box.x + scan.box.width) * k), by = oy + scan.box.y * k, bw = scan.box.width * k, bh = scan.box.height * k;

  // Wireframe
  ctx.lineWidth = 1;
  ctx.strokeStyle = line;
  ctx.shadowColor = line; ctx.shadowBlur = 6;
  for (const [s0, s1, closed] of RUNS) {
    ctx.beginPath();
    for (let i = s0; i <= s1; i++) (i === s0 ? ctx.moveTo : ctx.lineTo).call(ctx, pts[i].x, pts[i].y);
    if (closed) ctx.closePath();
    ctx.stroke();
  }
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  for (const [i, j] of LINKS) { ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Points, revealed by the sweeping beam
  const sweep = by + ((t / 1400) % 1) * bh;
  for (let i = 0; i < pts.length; i++) {
    const near = Math.abs(pts[i].y - sweep) < 14;
    ctx.fillStyle = dot;
    ctx.shadowColor = dot; ctx.shadowBlur = near ? 14 : 6;
    ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, near ? 2.6 : 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Scan beam across the face box
  if (!ok && !bad) {
    const grad = ctx.createLinearGradient(0, sweep - 18, 0, sweep + 2);
    grad.addColorStop(0, 'rgba(245, 221, 133, 0)');
    grad.addColorStop(1, 'rgba(245, 221, 133, 0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(bx - 6, sweep - 18, bw + 12, 20);
    ctx.strokeStyle = 'rgba(245, 221, 133, 0.9)';
    ctx.beginPath(); ctx.moveTo(bx - 6, sweep); ctx.lineTo(bx + bw + 6, sweep); ctx.stroke();
  }

  // Corner brackets that breathe
  const pad = 10 + Math.sin(t / 260) * 3, L = Math.min(bw, bh) * 0.18;
  ctx.strokeStyle = ok ? '#4ade80' : bad ? '#f87171' : '#e6b325';
  ctx.lineWidth = 2.2;
  const x0 = bx - pad, y0 = by - pad - 10, x1 = bx + bw + pad, y1 = by + bh + pad;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
  ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
  ctx.moveTo(x0, y1 - L); ctx.lineTo(x0, y1); ctx.lineTo(x0 + L, y1);
  ctx.moveTo(x1 - L, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - L);
  ctx.stroke();

  // Measurements
  const avg = (a: number, b2: number) => { let x = 0, y = 0; for (let i = a; i <= b2; i++) { x += pts[i].x; y += pts[i].y; } const n = b2 - a + 1; return { x: x / n, y: y / n }; };
  const eyeR = avg(36, 41), eyeL = avg(42, 47);
  const faceW = Math.hypot(pts[16].x - pts[0].x, pts[16].y - pts[0].y);
  const ratio = (a: Pt, b2: Pt) => (Math.hypot(a.x - b2.x, a.y - b2.y) / faceW).toFixed(3);
  const measure = (a: Pt, b2: Pt, label: string, off: number) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y + off); ctx.lineTo(b2.x, b2.y + off); ctx.stroke();
    ctx.setLineDash([]);
    for (const q of [a, b2]) { ctx.beginPath(); ctx.moveTo(q.x, q.y + off - 4); ctx.lineTo(q.x, q.y + off + 4); ctx.stroke(); }
    ctx.font = '600 9px "JetBrains Mono", monospace';
    const mx = (a.x + b2.x) / 2, my = (a.y + b2.y) / 2 + off;
    const tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(3, 32, 20, 0.75)';
    ctx.fillRect(mx - tw / 2, my - 15, tw, 12);
    ctx.fillStyle = '#f5dd85';
    ctx.textAlign = 'center';
    ctx.fillText(label, mx, my - 6);
  };
  const phaseT = Math.floor(t / 1500) % 3;
  if (phaseT === 0 || ok) measure(eyeR, eyeL, `IPD ${ratio(eyeR, eyeL)}`, -14);
  if (phaseT === 1 || ok) measure(pts[27], pts[8], `N-C ${ratio(pts[27], pts[8])}`, 0);
  if (phaseT === 2 || ok) measure(pts[0], pts[16], `FW 1.000`, 10);
}

export function FaceStep({ mode, target, onDone, onFail, onSkip }: {
  mode: 'enroll' | 'verify';
  target?: number[];
  onDone: (result: { descriptor?: number[]; distance?: number }) => void;
  onFail?: (reason: string) => void;
  onSkip?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scanRef = useRef<Scan | null>(null);
  const phaseRef = useRef<Phase>('loading');
  const cb = useRef({ onDone, onFail });
  cb.current = { onDone, onFail };
  const [phase, setPhaseState] = useState<Phase>('loading');
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const [msg, setMsg] = useState('Initialising biometric scanner…');
  const [progress, setProgress] = useState(0);
  const [hud, setHud] = useState({ points: 0, aligned: false, match: 0, samples: 0 });
  const [attempt, setAttempt] = useState(0);

  // Render loop for the overlay
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => { if (canvas.current) drawScan(canvas.current, scanRef.current, phaseRef.current, t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    scanRef.current = null;
    (async () => {
      try {
        setPhase('loading'); setProgress(0); setHud({ points: 0, aligned: false, match: 0, samples: 0 });
        setMsg('Starting camera…');
        stream = await startCamera(video.current!);
        if (cancelled) return;
        setMsg('Loading facial recognition model…');
        await loadFaceModels();
        if (cancelled) return;
        setPhase('scanning'); setMsg('Searching for a face…');
        const samples: Float32Array[] = [];
        let good = 0;
        const started = Date.now();
        while (!cancelled) {
          const r = await readFace(video.current!);
          if (cancelled) break;
          if (!r) {
            setMsg('Position your face inside the circle');
            setHud((h) => ({ ...h, points: 0, aligned: false }));
          } else {
            scanRef.current = { points: r.points, box: r.box, frame: r.frame, at: performance.now() };
            const cx = (r.box.x + r.box.width / 2) / r.frame.width, cy = (r.box.y + r.box.height / 2) / r.frame.height;
            const aligned = Math.abs(cx - 0.5) < 0.18 && Math.abs(cy - 0.5) < 0.22;
            if (mode === 'enroll') {
              samples.push(r.descriptor);
              setProgress(samples.length / 5);
              setHud({ points: r.points.length, aligned, match: 0, samples: samples.length });
              setMsg(samples.length < 3 ? 'Mapping facial geometry…' : 'Capturing reference template…');
              if (samples.length >= 5) {
                setPhase('success'); setMsg('Face template enrolled');
                await sleep(1100);
                if (!cancelled) cb.current.onDone({ descriptor: averageDescriptor(samples) });
                break;
              }
            } else {
              const d = faceDistance(r.descriptor, target!);
              const match = Math.max(0, Math.min(1, 1 - d / 1.2));
              setProgress(Math.max(0.08, Math.min(1, (0.85 - d) / (0.85 - FACE_MATCH_THRESHOLD))));
              setHud({ points: r.points.length, aligned, match, samples: 0 });
              if (d < FACE_MATCH_THRESHOLD) {
                good++;
                setMsg('Measuring and matching…');
                if (good >= 2) {
                  setPhase('success'); setProgress(1); setMsg('Identity confirmed');
                  await sleep(1100);
                  if (!cancelled) cb.current.onDone({ distance: d });
                  break;
                }
              } else {
                good = 0;
                setMsg(aligned ? 'Analysing facial features…' : 'Centre your face in the circle');
              }
            }
          }
          if (mode === 'verify' && Date.now() - started > 15000) {
            setPhase('error'); setMsg('Face not recognised');
            cb.current.onFail?.('face did not match within 15 seconds');
            break;
          }
          await sleep(140);
        }
      } catch (e) {
        if (!cancelled) { setPhase('error'); setMsg(biometricError(e)); cb.current.onFail?.(biometricError(e)); }
      } finally {
        stopCamera(stream);
      }
    })();
    return () => { cancelled = true; stopCamera(stream); };
  }, [attempt, mode, target]);

  const R = 142, C = 2 * Math.PI * R;
  const ringColor = phase === 'error' ? '#d12f2f' : phase === 'success' ? '#16a35a' : '#178a51';
  return (
    <div className="flex flex-col items-center animate-fade-in">
      <div className="relative h-[300px] w-[300px]">
        {/* Rotating instrument rings */}
        <svg viewBox="0 0 300 300" className={cx('absolute inset-0', phase === 'scanning' && 'animate-spin-slow')} style={{ animationDuration: '9s' }}>
          {Array.from({ length: 72 }).map((_, i) => {
            const a = (i / 72) * Math.PI * 2, long = i % 6 === 0;
            const r1 = 146, r2 = long ? 138 : 142;
            return <line key={i} x1={150 + Math.cos(a) * r1} y1={150 + Math.sin(a) * r1} x2={150 + Math.cos(a) * r2} y2={150 + Math.sin(a) * r2} stroke={long ? '#d19a12' : '#cbd5e1'} strokeWidth={long ? 1.6 : 1} />;
          })}
        </svg>
        <svg viewBox="0 0 300 300" className={cx('absolute inset-0', phase === 'scanning' && 'animate-spin-slow')} style={{ animationDuration: '3.2s', animationDirection: 'reverse' }}>
          <circle cx="150" cy="150" r="133" fill="none" stroke="#e6b325" strokeWidth="2" strokeDasharray="60 776" strokeLinecap="round" opacity={phase === 'scanning' ? 0.9 : 0} />
          <circle cx="150" cy="150" r="133" fill="none" stroke="#178a51" strokeWidth="2" strokeDasharray="24 812" strokeDashoffset="-420" strokeLinecap="round" opacity={phase === 'scanning' ? 0.9 : 0} />
        </svg>
        <svg viewBox="0 0 300 300" className="absolute inset-0 -rotate-90">
          <circle cx="150" cy="150" r={R} fill="none" stroke="#e2e8f0" strokeWidth="3" opacity="0.6" />
          <circle cx="150" cy="150" r={R} fill="none" strokeWidth="3" strokeLinecap="round" stroke={ringColor}
            strokeDasharray={C} strokeDashoffset={C * (1 - (phase === 'error' ? 1 : progress))} className="transition-[stroke-dashoffset] duration-500" />
        </svg>
        {/* Lens */}
        <div className={cx('absolute inset-[24px] overflow-hidden rounded-full bg-brand-950 shadow-[inset_0_0_40px_rgba(0,0,0,.6)] ring-4 transition-colors',
          phase === 'success' ? 'ring-brand-400/60' : phase === 'error' ? 'ring-danger-400/60' : 'ring-brand-900/10')}>
          <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover opacity-90" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-950/30 via-transparent to-brand-950/40" />
          <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
          {phase === 'loading' && <div className="absolute inset-0 flex items-center justify-center text-brand-200"><Loader2 className="h-8 w-8 animate-spin" /></div>}
          {phase === 'success' && <div className="absolute inset-x-0 bottom-6 flex justify-center"><span className="animate-pop rounded-full bg-brand-600 p-2 text-white shadow-lg"><Check className="h-6 w-6" strokeWidth={3} /></span></div>}
          {phase === 'error' && <div className="absolute inset-0 flex items-center justify-center bg-danger-900/40"><span className="animate-pop rounded-full bg-white p-3 text-danger-600"><X className="h-8 w-8" strokeWidth={3} /></span></div>}
        </div>
      </div>

      {/* Readout */}
      <div className="mt-4 grid w-full max-w-[300px] grid-cols-3 gap-1.5 font-mono text-[10px] uppercase tracking-wider">
        <Readout label="Points" value={`${hud.points}/68`} on={hud.points === 68} />
        <Readout label="Align" value={hud.aligned ? 'LOCK' : '—'} on={hud.aligned} />
        {mode === 'enroll'
          ? <Readout label="Samples" value={`${hud.samples}/5`} on={hud.samples >= 5} />
          : <Readout label="Match" value={hud.match ? `${Math.round(hud.match * 100)}%` : '—'} on={phase === 'success'} />}
      </div>
      <StatusLine phase={phase}>{msg}</StatusLine>
      {phase === 'error' && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button onClick={() => setAttempt((a) => a + 1)} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"><RotateCcw className="h-4 w-4" /> Scan again</button>
          {onSkip && <button onClick={onSkip} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100">Continue without face</button>}
        </div>
      )}
      {phase !== 'error' && <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Camera className="h-3.5 w-3.5" /> Processed on this device only</p>}
    </div>
  );
}

function Readout({ label, value, on }: { label: string; value: string; on: boolean }) {
  return (
    <div className={cx('rounded-lg border px-2 py-1.5 text-center transition-colors', on ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-slate-200 bg-slate-50 text-slate-500')}>
      <p className="text-[9px] opacity-70">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
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
      else if (!s.platform) { setPhase('unavailable'); setMsg(/Windows/.test(navigator.userAgent) ? 'Windows Hello is not ready. Make sure both the Windows Hello PIN and fingerprint are set up in Settings › Accounts › Sign-in options, then reload.' : 'No fingerprint sensor was found. Set up Touch ID or your device fingerprint, then reload.'); }
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
