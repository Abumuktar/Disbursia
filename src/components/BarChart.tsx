import { useState } from 'react';

export interface Bar { label: string; value: number; detail?: string }

/** Single-series vertical bar chart with hover tooltip. Values are formatted by the caller. */
export function BarChart({ data, format, height = 220 }: { data: Bar[]; format: (v: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * nice);
  const W = 640, H = height, padL = 64, padB = 28, padT = 12;
  const plotW = W - padL - 8, plotH = H - padB - padT;
  const bw = Math.min(56, (plotW / data.length) * 0.56);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Amount disbursed per month">
        {ticks.map((t) => {
          const y = padT + plotH - (t / nice) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={W - 8} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[11px]">{format(t)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const cx = padL + (plotW / data.length) * (i + 0.5);
          const h = (d.value / nice) * plotH;
          const y = padT + plotH - h;
          const r = Math.min(4, h);
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={cx - (plotW / data.length) / 2} y={padT} width={plotW / data.length} height={plotH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${cx - bw / 2},${padT + plotH} V${y + r} Q${cx - bw / 2},${y} ${cx - bw / 2 + r},${y} H${cx + bw / 2 - r} Q${cx + bw / 2},${y} ${cx + bw / 2},${y + r} V${padT + plotH} Z`}
                  fill={hover === i ? '#0a5833' : '#0b6e3f'}
                />
              )}
              <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${((padL + (plotW / data.length) * (hover + 0.5)) / W) * 100}%`, top: 0 }}>
          <p className="font-semibold text-slate-900">{data[hover].label}</p>
          <p className="tabular text-slate-700">{format(data[hover].value)}</p>
          {data[hover].detail && <p className="text-slate-500">{data[hover].detail}</p>}
        </div>
      )}
    </div>
  );
}

function niceMax(v: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * exp;
}
