import type { CSSProperties } from 'react';
import { cx } from './ui';

const GREEN = 'repeating-linear-gradient(180deg, #16a35a 0 0.07em, #0a6a37 0.07em 0.14em)';
const RED = 'repeating-linear-gradient(180deg, #ef4444 0 0.05em, #c62828 0.05em 0.1em)';

/** The Disbursia logo: heavy striped green lettering with a striped red dot over the final "i". */
export function Wordmark({ className }: { className?: string }) {
  const fill: CSSProperties = { backgroundImage: GREEN, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };
  return (
    <span className={cx('relative inline-flex select-none items-baseline font-logo font-black leading-[1.05] tracking-[-0.025em]', className)} role="img" aria-label="Disbursia">
      <span style={fill} aria-hidden>Disburs</span>
      <span className="relative" aria-hidden>
        <span style={fill}>ı</span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ top: '-0.02em', width: '0.3em', height: '0.3em', backgroundImage: RED }} />
      </span>
      <span style={fill} aria-hidden>a</span>
    </span>
  );
}

/** Logo on a white plate, for green or photographic backgrounds. */
export function LogoPlate({ className, size = 'text-2xl' }: { className?: string; size?: string }) {
  return (
    <span className={cx('inline-flex items-center rounded-xl bg-white px-3.5 pb-1.5 pt-2 shadow-sm ring-1 ring-black/5', className)}>
      <Wordmark className={size} />
    </span>
  );
}
