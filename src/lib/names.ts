export const FIRST_NAMES = [
  'Abubakar', 'Aisha', 'Musa', 'Fatima', 'Ibrahim', 'Hauwa', 'Usman', 'Zainab', 'Sani', 'Halima', 'Bello', 'Maryam',
  'Yusuf', 'Amina', 'Lawal', 'Hadiza', 'Aminu', 'Safiya', 'Nasiru', 'Rabi', 'Kabir', 'Jamila', 'Shehu', 'Bilkisu',
  'Mustapha', 'Asmau', 'Haruna', 'Khadija', 'Idris', 'Ladi', 'Garba', 'Murtala', 'Umar', 'Salisu', 'Hafsat', 'Tijjani',
  'Mansur', 'Rukayya', 'Bashir', 'Saadatu', 'Auwal', 'Zulaihat', 'Danladi', 'Hassana', 'Husaini', 'Habiba', 'Isa', 'Nafisa',
] as const;

export const SURNAMES = [
  'Abdullahi', 'Mohammed', 'Bello', 'Lawal', 'Sani', 'Yusuf', 'Ibrahim', 'Musa', 'Usman', 'Garba', 'Aliyu', 'Danjuma',
  'Dikko', 'Kankia', 'Mashi', 'Daura', 'Funtua', 'Abdulkadir', 'Suleiman', 'Tukur', 'Jibril', 'Bakori', 'Malumfashi',
  'Ingawa', 'Shuaibu', 'Isah', 'Nuhu', 'Rabiu', 'Dutsinma', 'Kafur', 'Batsari', 'Rimi', 'Jibia', 'Mani', 'Zango', 'Baure',
] as const;

const tokens = (s: string) =>
  s.toUpperCase().replace(/[^A-Z\s'-]/g, ' ').replace(/['-]/g, '').split(/\s+/).filter(Boolean);

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const tokenSim = (a: string, b: string) => 1 - lev(a, b) / Math.max(a.length, b.length);

/**
 * Order-insensitive name similarity in [0, 1]. Banks often return SURNAME FIRST in upper case,
 * so each submitted token is paired with its best counterpart in the bank record.
 * Tokens that are absent on either side (a dropped middle name) cost less than wrong tokens.
 */
export function nameSimilarity(submitted: string, resolved: string): number {
  const a = tokens(submitted), b = tokens(resolved);
  if (!a.length || !b.length) return 0;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const used = new Set<number>();
  let total = 0;
  for (const t of short) {
    let best = 0, bestIdx = -1;
    long.forEach((u, i) => {
      if (used.has(i)) return;
      const s = tokenSim(t, u);
      if (s > best) { best = s; bestIdx = i; }
    });
    if (bestIdx >= 0) used.add(bestIdx);
    total += best;
  }
  const coverage = total / short.length;
  const missing = long.length - short.length;
  return Math.max(0, coverage - missing * 0.08);
}
