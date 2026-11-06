import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, BadgeCheck, CheckCircle2, ChevronDown, ClipboardList, Eye, FileCheck2, Fingerprint, Gavel, GraduationCap,
  HandCoins, HeartPulse, KeyRound, Landmark, Lock, Menu, Network, Printer, ScrollText, ShieldCheck, Sprout, Timer, UploadCloud,
  UserCheck, Users, X, XCircle, Zap,
} from 'lucide-react';
import { Crest } from '../components/Crest';
import { Wordmark } from '../components/Wordmark';
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

const NAV = [['#about', 'About'], ['#journey', 'How it works'], ['#safeguards', 'Safeguards'], ['#programmes', 'Programmes'], ['#faq', 'FAQ']] as const;

/** Light grid paper background, as used behind the hero. */
const GRID_BG = {
  backgroundColor: '#f6f9f6',
  backgroundImage: 'linear-gradient(rgba(11,110,63,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(11,110,63,.06) 1px, transparent 1px)',
  backgroundSize: '72px 72px',
};

const ORBITS = [
  { icon: Landmark, label: 'Pensioners', pos: 'left-[6%] top-[14%]', tint: 'from-brand-100 to-brand-50 text-brand-700', delay: '0s' },
  { icon: GraduationCap, label: 'YEAP youths', pos: 'right-[6%] top-[14%]', tint: 'from-gold-100 to-gold-50 text-gold-700', delay: '-2s' },
  { icon: Sprout, label: 'Farmers', pos: 'left-[9%] bottom-[10%]', tint: 'from-gold-100 to-gold-50 text-gold-700', delay: '-4s' },
  { icon: HeartPulse, label: 'Health workers', pos: 'right-[9%] bottom-[10%]', tint: 'from-danger-100 to-danger-50 text-danger-600', delay: '-1s' },
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [active, setActive] = useState('');
  useEffect(() => {
    const h = () => {
      setScrolled(window.scrollY > 8);
      let cur = '';
      for (const [hash] of NAV) {
        const el = document.querySelector(hash);
        if (el && el.getBoundingClientRect().top < 140) cur = hash;
      }
      setActive(cur);
    };
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
      <header className={cx('fixed inset-x-0 top-0 z-40 bg-white/95 backdrop-blur-md transition-shadow duration-300', scrolled && 'shadow-[0_1px_0_rgba(15,23,42,.06),0_8px_24px_-12px_rgba(15,23,42,.12)]')}>
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:h-20 lg:px-8">
          <a href="#top" onClick={(e) => go(e, '#top')} className="flex shrink-0 items-center gap-3" aria-label="Disbursia home">
            <Crest className="h-10 w-10 lg:h-11 lg:w-11" />
            <span className="h-8 w-px bg-slate-200" />
            <div className="leading-none">
              <Wordmark className="text-[22px] lg:text-2xl" />
              <p className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:block">Katsina State Government</p>
            </div>
          </a>
          <nav className="mx-auto hidden items-center gap-1 lg:flex">
            {NAV.map(([h, l]) => (
              <a key={h} href={h} onClick={(e) => go(e, h)}
                className={cx('rounded-full px-4 py-2 text-[15px] font-semibold transition-colors', active === h ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-50 hover:text-brand-800')}>{l}</a>
            ))}
          </nav>
          <Link to="/login" className="ml-auto hidden items-center gap-2 rounded-full bg-brand-800 px-6 py-3 text-[15px] font-semibold text-white shadow-sm transition hover:bg-brand-900 sm:inline-flex lg:ml-0">
            Staff portal <ArrowUpRight className="h-4 w-4" />
          </Link>
          <button onClick={() => setMenu(true)} className="ml-auto rounded-lg p-2 text-slate-700 sm:ml-0 lg:hidden" aria-label="Open menu"><Menu className="h-6 w-6" /></button>
        </div>
      </header>
      {menu && (
        <div className="fixed inset-0 z-50 bg-white px-6 py-5 lg:hidden">
          <div className="flex items-center justify-between">
            <Wordmark className="text-2xl" />
            <button onClick={() => setMenu(false)} aria-label="Close menu" className="rounded-lg p-2 text-slate-700"><X className="h-6 w-6" /></button>
          </div>
          <nav className="mt-10 flex flex-col gap-1">
            {NAV.map(([h, l]) => <a key={h} href={h} onClick={(e) => go(e, h)} className="rounded-xl px-4 py-3.5 text-lg font-semibold text-slate-800 hover:bg-brand-50">{l}</a>)}
            <Link to="/login" className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand-800 px-6 py-4 font-semibold text-white"><Lock className="h-4 w-4" /> Staff portal</Link>
          </nav>
        </div>
      )}

      {/* Hero */}
      <section id="top" className="relative overflow-hidden pt-[72px] lg:pt-20" style={GRID_BG}>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
        {ORBITS.map((o, i) => (
          <div key={o.label} className={cx('absolute hidden xl:block', o.pos)}>
            <Reveal delay={300 + i * 120}>
              <div className="relative" style={{ animation: 'float 7s ease-in-out infinite', animationDelay: o.delay }}>
                <div className={cx('flex h-28 w-28 flex-col items-center justify-center rounded-full bg-gradient-to-br shadow-xl shadow-brand-900/10 ring-[6px] ring-white', o.tint)}>
                  <o.icon className="h-9 w-9" />
                  <span className="mt-1.5 text-[11px] font-bold">{o.label}</span>
                </div>
                <span className={cx('absolute flex h-9 w-9 items-center justify-center rounded-full bg-brand-800 text-white shadow-md', i % 2 === 0 ? '-right-8 bottom-2' : '-left-8 bottom-2')}>
                  <ArrowUpRight className={cx('h-4 w-4', i % 2 === 0 ? 'rotate-90' : '-rotate-0')} />
                </span>
              </div>
            </Reveal>
          </div>
        ))}
        <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-20 lg:pb-28 lg:pt-24">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-800 shadow-sm ring-1 ring-slate-200/70">
              <Zap className="h-4 w-4 fill-brand-700 text-brand-700" /> Office of the Accountant-General
            </span>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="mt-8 text-[40px] font-extrabold leading-[1.05] tracking-tight text-brand-900 sm:text-6xl lg:text-7xl">
              Every naira paid to the{' '}
              <span className="relative isolate inline-block whitespace-nowrap">
                right person
                <span className="absolute inset-x-0 -bottom-1 -z-0 h-3 rounded-sm bg-gold-400 sm:h-4" style={{ zIndex: -1 }} />
              </span>
              , on time
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="mx-auto mt-8 max-w-3xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              Disbursia is how the Katsina State Government pays pensioners, YEAP youths, farmers and health workers.
              Thousands at once, every name verified with the bank, every batch signed with PIN and OTP, and a receipt for every credit.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link to="/login" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-800 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-brand-900/20 transition hover:bg-brand-900 sm:w-auto">
                Open the staff portal <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="#journey" onClick={(e) => go(e, '#journey')} className="inline-flex w-full items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-brand-800 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-300 sm:w-auto">
                See how it works
              </a>
            </div>
          </Reveal>
          <Reveal delay={400}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-slate-600">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-600" />NIBSS name enquiry</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-600" />Dual signatories above ₦50m</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-600" />Tamper-evident audit</span>
            </div>
          </Reveal>
        </div>
        <div className="relative mx-auto max-w-5xl px-4 pb-10 sm:px-6">
          <Reveal delay={350}><HeroMock /></Reveal>
        </div>
      </section>

      {/* Impact numbers */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200 lg:grid-cols-4">
          {[
            { v: <CountUp to={45000} suffix="+" />, l: 'Citizens paid every month' },
            { v: <CountUp to={1.4} prefix="₦" suffix="bn" decimals={1} />, l: 'Moved monthly by four programmes' },
            { v: <><CountUp to={2} /> min</>, l: 'Batch time, down from 3–7 days' },
            { v: <CountUp to={34} />, l: 'LGAs in the rollout plan' },
          ].map((s, i) => (
            <div key={i} className="bg-white px-4 py-8 text-center sm:px-6">
              <p className="text-3xl font-extrabold tracking-tight text-brand-800 lg:text-4xl">{s.v}</p>
              <p className="mt-1.5 text-sm text-slate-500">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rails strip */}
      <section className="overflow-hidden pb-8" aria-label="Payment infrastructure">
        <p className="px-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Built on Nigeria's payment rails and public-finance controls</p>
        <div className="relative mt-6 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
          <div className="animate-marquee flex w-max gap-4">
            {[...RAILS, ...RAILS].map((r, i) => (
              <span key={i} className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm">
                <r.icon className="h-4 w-4 text-brand-600" />{r.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto grid max-w-7xl scroll-mt-24 grid-cols-1 items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-32">
        <Reveal className="order-2 lg:order-1"><AboutVisual /></Reveal>
        <Reveal delay={120} className="order-1 lg:order-2">
          <SectionEyebrow>About Disbursia</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-[42px] sm:leading-tight">From fifteen bank portals to <Mark>one authorized run</Mark></h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Paying 20,000 pensioners or 15,000 farmers used to mean separate uploads on many bank portals, spreadsheets passed around on WhatsApp,
            and payments returned for name mismatches. Disbursia replaces all of that with one secure desk and one defensible record.
          </p>
          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {['One source account for every programme', 'Thousands of payments per run', 'Receipts the state can print or share', 'Records ready for any auditor'].map((t) => (
              <li key={t} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />{t}
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* Journey */}
      <section id="journey" className="scroll-mt-24 bg-white pb-24 lg:pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <SectionEyebrow>How it works</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-[42px] sm:leading-tight">The journey of a payment</h2>
            <p className="mt-4 text-lg text-slate-600">From spreadsheet to beneficiary's account in under two minutes.</p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-x-16 gap-y-10 md:grid-cols-2">
            {JOURNEY.map((s, i) => (
              <Reveal key={s.t} delay={(i % 2) * 120} className={['', 'md:mt-40', 'md:-mt-20', 'md:mt-20'][i]}>
                <div className="relative ml-4 mt-4 rounded-2xl border border-gold-100 bg-gradient-to-br from-gold-50 via-white to-white p-7 pt-10 shadow-[0_10px_30px_-12px_rgba(140,89,14,.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-14px_rgba(140,89,14,.28)]">
                  <span className="absolute -left-4 -top-4 flex h-14 w-14 items-center justify-center rounded-2xl border-[3px] border-brand-800 bg-gold-200 text-xl font-extrabold text-brand-900 shadow-sm">{i + 1}</span>
                  <span className="absolute right-6 top-6 h-2.5 w-2.5 rounded-full bg-danger-500" />
                  <div className="flex items-center gap-3">
                    <s.icon className="h-5 w-5 text-brand-700" />
                    <h3 className="text-xl font-bold text-slate-900">{s.t}</h3>
                  </div>
                  <p className="mt-3 text-[15px] leading-7 text-slate-600">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Safeguards timeline */}
      <section id="safeguards" className="scroll-mt-24 py-24 lg:py-32" style={GRID_BG}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Safeguards</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-[42px] sm:leading-tight">Built so every payment can be <Mark>defended</Mark></h2>
          </Reveal>
          <div className="relative mt-16">
            <div className="absolute bottom-0 left-5 top-0 w-px bg-slate-300 md:left-1/2" />
            <div className="space-y-16 md:space-y-24">
              {SAFEGUARDS.map((g, i) => {
                const flip = i % 2 === 1;
                return (
                  <div key={g.t} className="relative grid grid-cols-1 items-center gap-8 pl-14 md:grid-cols-2 md:gap-20 md:pl-0">
                    <span className="absolute left-5 top-2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-md md:left-1/2 md:top-1/2 md:-translate-y-1/2">
                      <span className="h-4 w-4 rounded-full border-4 border-brand-800 bg-white" />
                    </span>
                    <Reveal className={cx(flip ? 'md:order-2 md:text-left' : 'md:text-right')}>
                      <div className={cx('inline-flex rounded-xl p-3', g.tint)}><g.icon className="h-6 w-6" /></div>
                      <h3 className="mt-4 text-2xl font-bold text-slate-900">{g.t}</h3>
                      <p className="mt-3 text-[17px] leading-relaxed text-slate-600">{g.d}</p>
                    </Reveal>
                    <Reveal delay={120} className={cx(flip && 'md:order-1')}>
                      <div className={cx('mx-auto max-w-sm', flip ? 'md:mr-0' : 'md:ml-0')}>{g.visual}</div>
                    </Reveal>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Who it serves */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Who it serves</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-[42px] sm:leading-tight">Clear roles, clear accountability</h2>
            <p className="mt-4 text-lg text-slate-600">Everyone sees exactly what their role needs, and no one person can move money alone.</p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r, i) => (
              <Reveal key={r.t} delay={i * 100}>
                <div className="group relative h-full overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-900/5">
                  <div className={cx('absolute inset-x-0 top-0 h-1', r.bar)} />
                  <div className={cx('inline-flex rounded-xl p-3', r.tint)}><r.icon className="h-6 w-6" /></div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900">{r.t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{r.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Programmes */}
      <section id="programmes" className="relative scroll-mt-24 overflow-hidden bg-brand-900 py-24 text-white lg:py-32">
        <div className="pattern-grid absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <SectionEyebrow light>Programmes</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-[42px] sm:leading-tight">Four flagship programmes, one record</h2>
            <p className="mt-4 text-lg text-brand-100">Each runs today as a manual batch exercise. On Disbursia, each becomes a verified, signed and receipted run.</p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
      <section id="pilot" className="py-24 lg:py-32">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <Reveal>
            <SectionEyebrow>The pilot</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-[42px] sm:leading-tight">Eight weeks, three programmes, three numbers</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              The pilot runs the November 2026 pensioners payroll, one YEAP cohort and one fertilizer subsidy round end to end. If it succeeds,
              rollout follows across every MDA that pays citizens and into the 34 LGAs for local-government salaries.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {['Weeks 1–2 · Pensions', 'Weeks 3–5 · YEAP', 'Weeks 6–8 · Fertilizer'].map((w) => (
                <span key={w} className="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-medium text-slate-700">{w}</span>
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
                <div className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6">
                  <div className={cx('shrink-0 rounded-xl p-3', m.tone === 'green' ? 'bg-brand-50 text-brand-600' : 'bg-gold-50 text-gold-600')}><m.icon className="h-6 w-6" /></div>
                  <p className="flex-1 font-medium text-slate-700">{m.t}</p>
                  <p className="shrink-0 text-xl font-extrabold tracking-tight text-brand-700 sm:text-2xl">{m.v}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 bg-slate-50 py-24 lg:py-32">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8">
          <Reveal>
            <SectionEyebrow>Questions</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-[42px] sm:leading-tight">Frequently asked</h2>
            <p className="mt-4 text-lg text-slate-600">How Disbursia protects public funds, and what changes for officers, signatories and beneficiaries.</p>
            <Link to="/login" className="mt-8 inline-flex items-center gap-2 font-semibold text-brand-700 hover:text-brand-800">Staff portal <ArrowRight className="h-4 w-4" /></Link>
          </Reveal>
          <Reveal delay={120}><Faq /></Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-24 sm:px-6 lg:px-8">
        <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand-800 px-6 py-14 text-center text-white shadow-xl sm:px-16 sm:py-20">
          <div className="pattern-grid absolute inset-0 opacity-40" />
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold-400/25 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-brand-500/30 blur-3xl" />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">A single, defensible record of <span className="text-gold-300">every naira paid</span></h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-brand-100">A working system is ready for live demonstration to the Office of the Accountant-General.</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/login" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold-400 px-8 py-4 font-semibold text-brand-950 shadow-lg transition hover:bg-gold-300 sm:w-auto">
                Open the staff portal <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="#faq" onClick={(e) => go(e, '#faq')} className="inline-flex w-full items-center justify-center rounded-xl px-8 py-4 font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/10 sm:w-auto">Read the FAQ</a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <Crest className="h-12 w-12" />
              <span className="h-9 w-px bg-slate-200" />
              <Wordmark className="text-2xl" />
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-500">Government of Katsina State · Office of the Accountant-General, Katsina State Secretariat, Katsina.</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Platform</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              {NAV.map(([h, l]) => <li key={h}><a href={h} onClick={(e) => go(e, h)} className="hover:text-brand-700">{l}</a></li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Access</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li><Link to="/login" className="hover:text-brand-700">Staff portal</Link></li>
              <li>Finance officers · Signatories · Auditors</li>
            </ul>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-brand-700 via-gold-400 to-danger-500" />
        <div className="bg-brand-950">
          <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 py-5 text-xs text-brand-300 sm:px-6 lg:px-8">
            <span>© {new Date().getFullYear()} Government of Katsina State. All rights reserved.</span>
            <span>For authorized government users only.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block">
      <span className="relative z-10">{children}</span>
      <span className="absolute inset-x-0 bottom-0.5 h-2.5 rounded-sm bg-gold-300/80" />
    </span>
  );
}

function SectionEyebrow({ children, light }: { children: ReactNode; light?: boolean }) {
  return (
    <p className={cx('inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em]', light ? 'text-gold-300' : 'text-gold-600')}>
      <span className={cx('h-px w-6', light ? 'bg-gold-300' : 'bg-gold-500')} />{children}
    </p>
  );
}

const JOURNEY = [
  { icon: UploadCloud, t: 'Upload', d: 'A finance officer chooses the programme and uploads the beneficiary spreadsheet. Account numbers are checked as the file is read.' },
  { icon: Fingerprint, t: 'Verify', d: 'Every name is resolved against the bank record through NIBSS. Mismatches, invalid accounts and duplicates are held back automatically.' },
  { icon: KeyRound, t: 'Authorize', d: 'A signatory approves the whole batch with one PIN and one OTP. Above ₦50 million, a second signatory must sign as well.' },
  { icon: Printer, t: 'Receipt', d: 'Funds move by NIP within minutes. Each beneficiary gets a crested receipt that can be printed, shared or filed.' },
];

const SAFEGUARDS = [
  {
    icon: BadgeCheck, t: 'Verify before pay', tint: 'bg-brand-50 text-brand-600',
    d: 'Every beneficiary name is confirmed against the bank record through the NIBSS directory before a single naira leaves the source account.',
    visual: (
      <div className="rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
        {[['Hauwa Sani Kankia', 'Matched', 'bg-brand-50 text-brand-700'], ['Fatima Garba', 'Partial', 'bg-gold-50 text-gold-800'], ['Abubakar Musa', 'Blocked', 'bg-danger-50 text-danger-700']].map(([n, s, c]) => (
          <div key={n} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
            <span className="truncate text-sm font-medium text-slate-800">{n}</span>
            <span className={cx('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold', c)}>{s}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: KeyRound, t: 'One authorized run', tint: 'bg-gold-50 text-gold-600',
    d: 'Thousands of payments move on one PIN and one OTP. Batches above ₦50 million need a second signatory, and nobody can authorize a batch they prepared.',
    visual: (
      <div className="rounded-2xl bg-brand-900 p-5 text-white shadow-xl">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-300">Authorize ₦12,000,000.00</p>
        <div className="mt-4 flex gap-2">{[0, 1, 2, 3].map((i) => <span key={i} className="flex h-10 flex-1 items-center justify-center rounded-lg bg-white/10 text-lg">•</span>)}</div>
        <div className="mt-3 flex gap-1.5">{'482913'.split('').map((d, i) => <span key={i} className="flex h-10 flex-1 items-center justify-center rounded-lg bg-white font-mono font-bold text-brand-900">{d}</span>)}</div>
      </div>
    ),
  },
  {
    icon: FileCheck2, t: 'A receipt per transaction', tint: 'bg-gold-50 text-gold-600',
    d: 'Every payment produces a printable receipt with the state crest, transaction reference, NIP session ID, sender, beneficiary and the signatories named in full.',
    visual: (
      <div className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center gap-3 bg-brand-700 px-4 py-3 text-white"><Crest className="h-8 w-8 rounded-full bg-white p-0.5" /><span className="text-xs font-semibold">Payment receipt</span></div>
        <div className="h-1 bg-gold-400" />
        <div className="space-y-1.5 p-4 text-xs text-slate-500">
          <p className="text-2xl font-extrabold tabular text-slate-900">₦30,000.00</p>
          <p>To Hadiza Aminu Bakori · Jaiz Bank</p>
          <p className="font-mono">DSB-2611-YEAP-0005/00042</p>
        </div>
      </div>
    ),
  },
  {
    icon: ScrollText, t: 'An immutable audit trail', tint: 'bg-danger-50 text-danger-600',
    d: 'Every action is logged with actor, time and prior state, and hash-chained so any change is detectable. The Auditor-General, EFCC or ICPC can trace a payment end to end.',
    visual: (
      <div className="space-y-2">
        {[['#151', 'Batch signed', '9f3a…c21e'], ['#152', 'Payout started', '41b7…08d2'], ['#153', 'Payout completed', 'e0c9…7a54']].map(([n, a, h]) => (
          <div key={n} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-md ring-1 ring-slate-200">
            <span className="font-mono text-xs text-slate-400">{n}</span>
            <span className="flex-1 truncate text-sm font-medium text-slate-800">{a}</span>
            <span className="font-mono text-[11px] text-brand-700">{h}</span>
          </div>
        ))}
      </div>
    ),
  },
];

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

const RAILS = [
  { icon: Network, label: 'NIBSS Instant Payment (NIP)' },
  { icon: UserCheck, label: 'NIBSS Name Enquiry' },
  { icon: BadgeCheck, label: 'CBN NUBAN standard' },
  { icon: Landmark, label: 'Sterling Bank' },
  { icon: KeyRound, label: 'PIN + SMS OTP' },
  { icon: ScrollText, label: 'SHA-256 audit chain' },
  { icon: Gavel, label: 'Office of the Auditor-General' },
];

const ROLES = [
  { icon: ClipboardList, t: 'Finance officers', d: 'Prepare a batch from one spreadsheet, see every name check, and decide on partial matches before submitting.', bar: 'bg-brand-500', tint: 'bg-brand-50 text-brand-600' },
  { icon: KeyRound, t: 'Signatories', d: 'Review the totals and authorize the whole batch with one PIN and one OTP. Two signatories are needed above ₦50 million.', bar: 'bg-gold-400', tint: 'bg-gold-50 text-gold-600' },
  { icon: Eye, t: 'Auditors & investigators', d: 'Trace any payment end to end without requesting a special report, and verify that the record has not been altered.', bar: 'bg-danger-500', tint: 'bg-danger-50 text-danger-600' },
  { icon: HandCoins, t: 'Beneficiaries', d: 'Pensioners, youths, farmers and health workers get paid on time, to the right account, with a receipt to show for it.', bar: 'bg-brand-500', tint: 'bg-brand-50 text-brand-600' },
];

const FAQS = [
  { q: 'How does Disbursia stop money going to the wrong person?', a: 'Before anything is paid, every account number is validated and the account name is fetched from the bank through NIBSS. Names that do not match are blocked, near matches need an officer decision, and duplicate accounts in the same file are held back.' },
  { q: 'Who can authorize a payment?', a: 'Only designated signatories, using their PIN and a one-time password sent to their phone. Batches above ₦50 million need two different signatories, and the officer who prepared a batch can never authorize it.' },
  { q: 'What happens if a payment fails?', a: 'Failed transfers are not debited. They are listed with the bank\'s reason, and a signatory can re-run them with a fresh PIN and OTP once the destination bank is available.' },
  { q: 'Can the records be changed after the fact?', a: 'No. Every action is written to an audit log where each entry is chained to the one before it with a SHA-256 hash. Changing any past entry breaks the chain, and the integrity check shows exactly where.' },
  { q: 'What file formats can be uploaded?', a: 'Excel (.xlsx) and CSV. Disbursia recognises common column names such as account number, bank code or bank name, account name and amount, and a template is available to download.' },
  { q: 'Which programmes are covered?', a: 'The pilot covers monthly pensions, YEAP stipends and a fertilizer subsidy round, alongside PHC worker allowances. After a successful pilot, rollout extends to every MDA that pays citizens and to the 34 LGAs.' },
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="divide-y divide-slate-200 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q}>
            <button onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
              <span className="font-semibold text-slate-900">{f.q}</span>
              <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300', isOpen ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500')}>
                <ChevronDown className={cx('h-4 w-4 transition-transform duration-300', isOpen && 'rotate-180')} />
              </span>
            </button>
            <div className={cx('grid transition-[grid-template-rows] duration-300 ease-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
              <div className="overflow-hidden">
                <p className="px-6 pb-6 leading-relaxed text-slate-600">{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AboutVisual() {
  return (
    <div className="relative mx-auto max-w-lg">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-brand-100 via-gold-50 to-brand-50" />
      <div className="relative rounded-3xl bg-brand-900 p-6 text-white shadow-2xl sm:p-8">
        <div className="pattern-grid absolute inset-0 rounded-3xl opacity-40" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-300">Batch summary</p>
            <p className="mt-1 text-2xl font-bold tabular sm:text-3xl">₦12,000,000.00</p>
            <p className="text-sm text-brand-200">400 YEAP beneficiaries</p>
          </div>
          <span className="rounded-full bg-gold-400 px-3 py-1 text-xs font-bold text-brand-950">PIN + OTP</span>
        </div>
        <div className="relative mt-6 grid grid-cols-3 gap-3 text-center">
          {[['396', 'Matched', 'text-brand-300'], ['3', 'Partial', 'text-gold-300'], ['1', 'Blocked', 'text-danger-300']].map(([n, l, c]) => (
            <div key={l} className="rounded-xl bg-white/5 px-2 py-3 ring-1 ring-white/10">
              <p className={cx('text-xl font-bold', c)}>{n}</p>
              <p className="text-[11px] text-brand-200">{l}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="animate-float relative -mt-6 ml-auto w-[85%] rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/5 sm:-mt-8">
        <div className="flex items-center gap-3">
          <Crest className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gold-600">Payment receipt</p>
            <p className="truncate font-mono text-xs text-slate-500">DSB-2611-YEAP-0005/00042</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700"><CheckCircle2 className="h-3 w-3" />Paid</span>
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-dashed border-slate-200 pt-3">
          <div>
            <p className="text-xs text-slate-500">To Hadiza Aminu Bakori · Jaiz Bank</p>
            <p className="text-xl font-extrabold tabular text-slate-900">₦30,000.00</p>
          </div>
          <GraduationCap className="h-6 w-6 text-brand-600" />
        </div>
      </div>
    </div>
  );
}
