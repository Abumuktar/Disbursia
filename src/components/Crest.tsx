import { useState } from 'react';
import { cx } from './ui';

/**
 * The official crest is loaded from /katsina-crest.png (place the state's artwork in /public).
 * Until it is present, a neutral green-and-gold seal is drawn instead.
 */
export function Crest({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return <img src={`${import.meta.env.BASE_URL}katsina-crest.png`} alt="Katsina State Government crest" className={cx('object-contain', className)} onError={() => setFailed(true)} />;
  }
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Katsina State Government seal">
      <circle cx="60" cy="60" r="58" fill="#e6b325" />
      <circle cx="60" cy="60" r="54" fill="#0b6e3f" />
      <circle cx="60" cy="60" r="37" fill="#fff" stroke="#e6b325" strokeWidth="2.5" />
      <defs>
        <path id="crest-top" d="M 16 60 A 44 44 0 0 1 104 60" />
        <path id="crest-bottom" d="M 20 64 A 40 40 0 0 0 100 64" />
      </defs>
      <text fill="#fff" fontSize="9.5" fontWeight="800" letterSpacing="1.2" fontFamily="Inter, sans-serif">
        <textPath href="#crest-top" startOffset="50%" textAnchor="middle">KATSINA STATE</textPath>
      </text>
      <text fill="#fff" fontSize="8.5" fontWeight="800" letterSpacing="1.4" fontFamily="Inter, sans-serif">
        <textPath href="#crest-bottom" startOffset="50%" textAnchor="middle" dominantBaseline="hanging">GOVERNMENT</textPath>
      </text>
      {/* Gobarau-style tower */}
      <path d="M50 82 L52 48 L49 48 L49 42 L52 42 L52 39 L55 39 L55 42 L58.5 42 L58.5 39 L61.5 39 L61.5 42 L65 42 L65 39 L68 39 L68 42 L71 42 L71 48 L68 48 L70 82 Z" fill="#c62828" />
      <path d="M58 56 l2 -4 l2 4 v4 h-4z M58 68 l2 -4 l2 4 v4 h-4z" fill="#fff" />
      <path d="M38 84 Q60 74 82 84 L82 88 Q60 80 38 88 Z" fill="#178a51" />
      {[...Array(10)].map((_, i) => {
        const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
        return <circle key={i} cx={60 + Math.cos(a) * 31} cy={60 + Math.sin(a) * 31} r="1.6" fill="#d19a12" />;
      })}
    </svg>
  );
}
