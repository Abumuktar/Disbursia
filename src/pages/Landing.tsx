import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Banknote, Building2, CheckCircle2, ClipboardList, FileCheck2, Fingerprint, HeartPulse, KeyRound,
  Landmark, Lock, Menu, MessageSquareWarning, Printer, ScrollText, ShieldCheck, Sprout, Timer, UploadCloud, Users, X, XCircle,
} from 'lucide-react';
import { Crest } from '../components/Crest';
import { LogoPlate, Wordmark } from '../components/Wordmark';
import { cx } from '../components/ui';

function useInView<T extends Element>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return <div ref={ref} className={cx('reveal', inView && 'in', className)} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

function CountUp({ to, prefix = '', suffix = '', decimals = 0 }: { to: number; prefix?: string; suffix?: string; decimals?: number }) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.4);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1600);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);
  return <span ref={ref} className="tabular">{prefix}{v.toLocaleString('en-NG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

const NAV = [['#how', 'How it works'], ['#safeguards', 'Safeguards'], ['#programmes', 'Programmes'], ['#pilot', 'Pilot']] as const;

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24);
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  const go = (e: React.MouseEvent, hash: string) => {
    e.preventDefault();
    setMenu(false);
    document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="bg-white text-slate-800">
      {/* Navigation */}
      <header className={cx('fixed inset-x-0 top-0 z-40 transition-all duration-300', scrolled ? 'bg-white/90 shadow-sm backdrop-blur-md' : 'bg-transparent')}>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:h-20 lg:px-8">
          <a href="#top" onClick={(e) => go(e, '#top')} className="flex items-center gap-3">
            <Crest className="h-10 w-10 lg:h-11 lg:w-11" />
            <div className="leading-tight">
              {scrolled ? <Wordmark className="text-2xl" /> : <LogoPlate size="text-xl" className="px-2.5 pb-1 pt-1.5" />}
              <p className={cx('mt-1 hidden text-[11px] font-medium sm:block', scrolled ? 'text-slate-500' : 'text-brand-200')}>Katsina State Government</p>
            </div>
          </a>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map(([h, l]) => (
              <a key={h} href={h} onClick={(e) => go(e, h)} className={cx('rounded-lg px-3 py-2 text-sm font-medium transition-colors', scrolled ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-brand-100 hover:bg-white/10 hover:text-white')}>{l}</a>
            ))}
          </nav>
          <Link to="/login" className="ml-auto hidden items-center gap-2 rounded-lg bg-gold-400 px-4 py-2 text-sm font-semibold text-brand-950 shadow-sm transition hover:bg-gold-300 md:ml-2 md:inline-flex">
            <Lock className="h-4 w-4" /> Sign in
          </Link>
          <button onClick={() => setMenu(true)} className={cx('ml-auto rounded-lg p-2 md:hidden', scrolled ? 'text-slate-700' : 'text-white')} aria-label="Open menu"><Menu className="h-6 w-6" /></button>
        </div>
      </header>
      {menu && (
        <div className="fixed inset-0 z-50 bg-brand-950/95 px-6 py-6 text-white backdrop-blur md:hidden">
          <div className="flex justify-end"><button onClick={() => setMenu(false)} aria-label="Close menu"><X className="h-7 w-7" /></button></div>
          <nav className="mt-8 flex flex-col gap-2">
            {NAV.map(([h, l]) => <a key={h} href={h} onClick={(e) => go(e, h)} className="rounded-lg px-3 py-3 text-xl font-semibold hover:bg-white/10">{l}</a>)}
            <Link to="/login" className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-gold-400 px-4 py-3 font-semibold text-brand-950"><Lock className="h-4 w-4" /> Sign in</Link>
          </nav>
        </div>
      )}

      {/* Hero */}
      <section id="top" className="relative overflow-hidden bg-brand-900 pb-24 pt-32 text-white lg:pb-32 lg:pt-44">
        <div className="pattern-grid absolute inset-0 opacity-50" />
        <div className="animate-drift absolute -left-40 top-10 h-[480px] w-[480px] rounded-full bg-brand-600/30 blur-3xl" />
        <div className="animate-drift absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-gold-500/15 blur-3xl" style={{ animationDelay: '-7s' }} />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:px-8">
          <div>
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-gold-300/30 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold-300">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-400" /> Office of the Accountant-General
              </p>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Every naira,<br />
                <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-200 bg-clip-text text-transparent">verified, authorized</span><br />
                and receipted.
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-brand-100">
                Disbursia lets the Katsina State Government pay thousands of pensioners, youths, farmers and health workers at once.
                Names are checked with the bank, payments are signed with PIN and OTP, and every credit comes with a receipt.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/login" className="group inline-flex items-center gap-2 rounded-xl bg-gold-400 px-6 py-3.5 text-[15px] font-semibold text-brand-950 shadow-lg shadow-gold-900/20 transition hover:bg-gold-300">
                  Sign in to Disbursia <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <a href="#how" onClick={(e) => go(e, '#how')} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-white/10">See how it works</a>
              </div>
            </Reveal>
            <Reveal delay={400}>
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-brand-200">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold-300" />NIBSS name enquiry</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold-300" />Dual signatories above ₦50m</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold-300" />Tamper-evident audit</span>
              </div>
            </Reveal>
          </div>
          <Reveal delay={250}><HeroMock /></Reveal>
        </div>
      </section>

      {/* Impact numbers */}
      <section className="relative z-10 -mt-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-2 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 lg:grid-cols-4">
          {[
            { v: <CountUp to={45000} suffix="+" />, l: 'Citizens paid every month' },
            { v: <CountUp to={1.4} prefix="₦" suffix="bn" decimals={1} />, l: 'Moved monthly by four programmes' },
            { v: <><CountUp to={2} /> min</>, l: 'Batch time, down from 3 to 7 days' },
            { v: <CountUp to={34} />, l: 'LGAs in the rollout plan' },
          ].map((s, i) => (
            <div key={i} className={cx('px-6 py-7 text-center', i % 2 === 0 && 'border-r border-slate-100', i < 2 && 'border-b border-slate-100 lg:border-b-0', i === 1 && 'lg:border-r')}>
              <p className="text-3xl font-extrabold tracking-tight text-brand-700 lg:text-4xl">{s.v}</p>
              <p className="mt-1 text-sm text-slate-500">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem vs solution */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Why it matters</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">From fifteen bank portals to one authorized run</h2>
          <p className="mt-4 text-lg text-slate-600">Late stipends make the evening news. Subsidy that reaches the wrong farmer undermines the whole programme. Disbursia closes the gap between authorization and audit.</p>
        </Reveal>
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-danger-100 bg-gradient-to-br from-danger-50 to-white p-8">
              <p className="inline-flex items-center gap-2 rounded-full bg-danger-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-danger-700"><XCircle className="h-3.5 w-3.5" /> Today</p>
              <ul className="mt-6 space-y-5">
                {[
                  [Building2, '15 separate uploads on 15 bank portals'],
                  [MessageSquareWarning, 'Spreadsheets passed around by email and WhatsApp'],
                  [Users, 'Name-mismatch returns that credit the wrong people'],
                  [ClipboardList, 'Audit evidence sitting in printed folders'],
                ].map(([Icon, t], i) => {
                  const I = Icon as typeof Building2;
                  return <li key={i} className="flex items-start gap-4"><span className="rounded-lg bg-white p-2 text-danger-600 shadow-sm ring-1 ring-danger-100"><I className="h-5 w-5" /></span><span className="pt-1.5 text-slate-700">{t as string}</span></li>;
                })}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="h-full rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-8">
              <p className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700"><CheckCircle2 className="h-3.5 w-3.5" /> With Disbursia</p>
              <ul className="mt-6 space-y-5">
                {[
                  [Landmark, 'One platform and one source account for every programme'],
                  [UploadCloud, 'One spreadsheet upload, checked row by row'],
                  [BadgeCheck, 'Every name confirmed with the bank before any money moves'],
                  [ScrollText, 'An end-to-end record any auditor can trace in minutes'],
                ].map(([Icon, t], i) => {
                  const I = Icon as typeof Building2;
                  return <li key={i} className="flex items-start gap-4"><span className="rounded-lg bg-white p-2 text-brand-600 shadow-sm ring-1 ring-brand-100"><I className="h-5 w-5" /></span><span className="pt-1.5 text-slate-700">{t as string}</span></li>;
                })}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 bg-slate-50 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <SectionEyebrow>How it works</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Four steps, under two minutes</h2>
            <p className="mt-4 text-lg text-slate-600">A finance officer prepares the batch. A signatory authorizes it. Disbursia does the rest.</p>
          </Reveal>
          <div className="relative mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="absolute left-0 right-0 top-8 hidden h-0.5 bg-gradient-to-r from-brand-200 via-gold-300 to-brand-200 lg:block" />
            {[
              { icon: UploadCloud, t: 'Upload', d: 'Choose the programme and upload the beneficiary spreadsheet. Account numbers are checked as the file is read.' },
              { icon: Fingerprint, t: 'Verify', d: 'Each name is resolved against the bank record through NIBSS. Mismatches and duplicates are held back.' },
              { icon: KeyRound, t: 'Authorize', d: 'The signatory approves the whole batch with one PIN and one OTP. Above ₦50m, a second signatory signs too.' },
              { icon: Printer, t: 'Receipt', d: 'Funds move by NIP. Each beneficiary gets a crested receipt that can be printed, shared or filed.' },
            ].map((s, i) => (
              <Reveal key={s.t} delay={i * 120}>
                <div className="relative">
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-lg shadow-brand-900/20 ring-4 ring-slate-50">
                    <s.icon className="h-7 w-7" />
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gold-400 text-xs font-bold text-brand-950">{i + 1}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-slate-900">{s.t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Safeguards */}
      <section id="safeguards" className="scroll-mt-20 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Safeguards</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Built so every payment can be defended</h2>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {[
              { icon: BadgeCheck, t: 'Verify before pay', d: 'Every beneficiary name is confirmed against the bank record through the NIBSS directory before a single naira leaves the source account. Invalid NUBANs, closed accounts and duplicates never reach payment.', tone: 'green' },
              { icon: KeyRound, t: 'One authorized run', d: 'A whole batch of thousands moves on one PIN and one OTP. Batches above ₦50 million need a second signatory, and nobody can authorize a batch they prepared.', tone: 'gold' },
              { icon: FileCheck2, t: 'A receipt per transaction', d: 'Every payment produces a printable receipt with the state crest, transaction reference, NIP session ID, sender, beneficiary and the signatories named in full.', tone: 'gold' },
              { icon: ScrollText, t: 'An immutable audit trail', d: 'Every action is logged with actor, time and prior state, and hash-chained so any change is detectable. The Auditor-General, EFCC or ICPC can trace a disbursement end to end.', tone: 'green' },
            ].map((p, i) => (
              <Reveal key={p.t} delay={(i % 2) * 120}>
                <div className="group h-full rounded-2xl border border-slate-200 bg-white p-8 transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-900/5">
                  <div className={cx('inline-flex rounded-xl p-3 transition-colors', p.tone === 'green' ? 'bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white' : 'bg-gold-50 text-gold-600 group-hover:bg-gold-400 group-hover:text-brand-950')}>
                    <p.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-slate-900">{p.t}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{p.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Programmes */}
      <section id="programmes" className="relative scroll-mt-20 overflow-hidden bg-brand-900 py-24 text-white lg:py-32">
        <div className="pattern-grid absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <SectionEyebrow light>Programmes</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Four flagship programmes, one record</h2>
            <p className="mt-4 text-lg text-brand-100">Each runs today as a manual batch exercise. On Disbursia, each becomes a verified, signed and receipted run.</p>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Landmark, n: 20000, t: 'Monthly pensions', d: 'Retired state and local government staff' },
              { icon: Users, n: 5000, t: 'YEAP stipends', d: 'Youth Empowerment Programme cohorts' },
              { icon: Sprout, n: 15000, t: 'Fertilizer subsidy', d: 'Registered farmers per planting round' },
              { icon: HeartPulse, n: 5200, t: 'PHC allowances', d: 'Primary healthcare workers across 34 LGAs' },
            ].map((p, i) => (
              <Reveal key={p.t} delay={i * 100}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:bg-white/10">
                  <p.icon className="h-7 w-7 text-gold-300" />
                  <p className="mt-5 text-3xl font-extrabold"><CountUp to={p.n} /></p>
                  <p className="mt-1 font-semibold">{p.t}</p>
                  <p className="mt-1 text-sm text-brand-200">{p.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pilot */}
      <section id="pilot" className="scroll-mt-20 py-24 lg:py-32">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <Reveal>
            <SectionEyebrow>The pilot</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Eight weeks, three programmes, three numbers</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              The pilot with the Office of the Accountant-General runs the November 2026 pensioners payroll, one YEAP cohort and one
              fertilizer subsidy round end to end. If it succeeds, rollout follows across every MDA that pays citizens and into the 34 LGAs for local-government salaries.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {['Week 1–2 · Pensions', 'Week 3–5 · YEAP', 'Week 6–8 · Fertilizer'].map((w) => (
                <span key={w} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">{w}</span>
              ))}
            </div>
          </Reveal>
          <div className="space-y-4">
            {[
              { icon: Timer, v: '≤ 15 min', t: 'From authorizing signature to credit', tone: 'green' },
              { icon: Users, v: '< 1%', t: 'Name-mismatch returns across all transactions', tone: 'gold' },
              { icon: ShieldCheck, v: '0', t: 'Gaps in the audit log', tone: 'green' },
            ].map((m, i) => (
              <Reveal key={m.t} delay={i * 120}>
                <div className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
                  <div className={cx('rounded-xl p-3', m.tone === 'green' ? 'bg-brand-50 text-brand-600' : 'bg-gold-50 text-gold-600')}><m.icon className="h-6 w-6" /></div>
                  <p className="flex-1 font-medium text-slate-700">{m.t}</p>
                  <p className="text-2xl font-extrabold tracking-tight text-brand-700">{m.v}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-gold-300 via-gold-400 to-gold-500 px-8 py-14 text-center shadow-xl sm:px-16">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/20 blur-2xl" />
          <Banknote className="mx-auto h-10 w-10 text-brand-900" />
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-brand-950 sm:text-4xl">A single, defensible record of every naira paid</h2>
          <p className="mx-auto mt-4 max-w-xl text-brand-900/80">A working system is ready for live demonstration to the Office of the Accountant-General.</p>
          <Link to="/login" className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-800 px-7 py-3.5 font-semibold text-white shadow-lg transition hover:bg-brand-900">
            Open the demonstration <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="bg-brand-950 text-brand-200">
        <div className="h-1 bg-gold-400" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <Crest className="h-12 w-12" />
              <div>
                <LogoPlate size="text-xl" className="px-2.5 pb-1 pt-1.5" />
                <p className="mt-1 text-xs">Government of Katsina State</p>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed">Office of the Accountant-General, Katsina State Secretariat, Katsina.</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gold-300">Platform</p>
            <ul className="mt-4 space-y-2 text-sm">
              {NAV.map(([h, l]) => <li key={h}><a href={h} onClick={(e) => go(e, h)} className="hover:text-white">{l}</a></li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gold-300">Access</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/login" className="hover:text-white">Staff sign in</Link></li>
              <li>Finance officers · Signatories · Auditors</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 py-5 text-xs text-brand-300 sm:px-6 lg:px-8">
            <span>© {new Date().getFullYear()} Government of Katsina State. All rights reserved.</span>
            <span>For authorized government users only.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionEyebrow({ children, light }: { children: ReactNode; light?: boolean }) {
  return (
    <p className={cx('inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em]', light ? 'text-gold-300' : 'text-gold-600')}>
      <span className={cx('h-px w-6', light ? 'bg-gold-300' : 'bg-gold-500')} />{children}
    </p>
  );
}

const MOCK_ROWS = [
  { n: 'Hauwa Sani Kankia', a: '₦45,000.00', s: 'ok' },
  { n: 'Usman Bello Daura', a: '₦62,350.00', s: 'ok' },
  { n: 'Fatima Garba', a: '₦30,000.00', s: 'partial' },
  { n: 'Ibrahim Lawal Funtua', a: '₦90,000.00', s: 'ok' },
  { n: 'Abubakar Musa', a: '₦45,000.00', s: 'bad' },
] as const;

function HeroMock() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTick(MOCK_ROWS.length + 3); return; }
    const t = setInterval(() => setTick((x) => (x + 1) % (MOCK_ROWS.length + 6)), 900);
    return () => clearInterval(t);
  }, []);
  const shown = Math.min(tick, MOCK_ROWS.length);
  const done = tick > MOCK_ROWS.length;
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="animate-float rounded-2xl bg-white p-5 text-slate-800 shadow-2xl shadow-black/30 ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-600">Monthly Pensions · November 2026</p>
            <p className="font-mono text-sm font-semibold">DSB-2611-PEN-0005</p>
          </div>
          <span className={cx('rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition-colors', done ? 'bg-brand-50 text-brand-700 ring-brand-600/20' : 'bg-sky-50 text-sky-700 ring-sky-600/20')}>
            {done ? 'Verified' : 'Verifying…'}
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500 transition-[width] duration-700" style={{ width: `${(shown / MOCK_ROWS.length) * 100}%` }} />
        </div>
        <ul className="mt-4 space-y-2">
          {MOCK_ROWS.map((r, i) => (
            <li key={r.n} className={cx('flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm transition-opacity duration-500', i < shown ? 'opacity-100' : 'opacity-30')}>
              <span className="flex-1 truncate font-medium">{r.n}</span>
              <span className="tabular text-slate-500">{r.a}</span>
              {i < shown ? (
                r.s === 'ok' ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700"><CheckCircle2 className="h-3 w-3" />Matched</span>
                  : r.s === 'partial' ? <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-semibold text-gold-800">Partial</span>
                  : <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-semibold text-danger-700"><XCircle className="h-3 w-3" />Blocked</span>
              ) : <span className="h-4 w-16 animate-pulse rounded-full bg-slate-100" />}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-900 px-4 py-3 text-white">
          <div>
            <p className="text-[11px] text-brand-300">Ready to authorize</p>
            <p className="text-lg font-bold tabular">₦97,412,850.00</p>
          </div>
          <span className={cx('inline-flex items-center gap-1.5 rounded-lg bg-gold-400 px-3 py-2 text-xs font-bold text-brand-950', done && 'animate-pulse-ring')}><KeyRound className="h-3.5 w-3.5" />PIN + OTP</span>
        </div>
      </div>
      <div className="absolute -bottom-6 -left-6 hidden rounded-xl bg-white px-4 py-3 shadow-xl ring-1 ring-black/5 sm:block" style={{ animation: 'float 7s ease-in-out infinite', animationDelay: '-2s' }}>
        <p className="flex items-center gap-2 text-xs font-semibold text-brand-700"><FileCheck2 className="h-4 w-4" /> Receipt issued</p>
        <p className="font-mono text-[11px] text-slate-500">DSB-2610-PEN-0004/00127</p>
      </div>
      <div className="absolute -right-4 -top-5 hidden rounded-xl bg-white px-4 py-3 shadow-xl ring-1 ring-black/5 sm:block" style={{ animation: 'float 8s ease-in-out infinite', animationDelay: '-4s' }}>
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-700"><ShieldCheck className="h-4 w-4 text-brand-600" /> Audit chain intact</p>
      </div>
    </div>
  );
}
