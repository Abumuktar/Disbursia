import { digits } from './rng';

export interface Bank { code: string; name: string; short: string }

export const BANKS: Bank[] = [
  { code: '044', name: 'Access Bank', short: 'Access' },
  { code: '023', name: 'Citibank Nigeria', short: 'Citi' },
  { code: '050', name: 'Ecobank Nigeria', short: 'Ecobank' },
  { code: '070', name: 'Fidelity Bank', short: 'Fidelity' },
  { code: '011', name: 'First Bank of Nigeria', short: 'FirstBank' },
  { code: '214', name: 'First City Monument Bank', short: 'FCMB' },
  { code: '058', name: 'Guaranty Trust Bank', short: 'GTBank' },
  { code: '030', name: 'Heritage Bank', short: 'Heritage' },
  { code: '301', name: 'Jaiz Bank', short: 'Jaiz' },
  { code: '082', name: 'Keystone Bank', short: 'Keystone' },
  { code: '076', name: 'Polaris Bank', short: 'Polaris' },
  { code: '221', name: 'Stanbic IBTC Bank', short: 'Stanbic' },
  { code: '232', name: 'Sterling Bank', short: 'Sterling' },
  { code: '032', name: 'Union Bank of Nigeria', short: 'Union' },
  { code: '033', name: 'United Bank for Africa', short: 'UBA' },
  { code: '215', name: 'Unity Bank', short: 'Unity' },
  { code: '035', name: 'Wema Bank', short: 'Wema' },
  { code: '057', name: 'Zenith Bank', short: 'Zenith' },
];

const byCode = new Map(BANKS.map((b) => [b.code, b]));
export const bankName = (code: string) => byCode.get(code)?.name ?? `Unknown bank (${code})`;
export const bankShort = (code: string) => byCode.get(code)?.short ?? code;
export const isKnownBank = (code: string) => byCode.has(code);

export function findBank(input: string): Bank | undefined {
  const s = input.trim();
  if (/^\d+$/.test(s)) return byCode.get(s.padStart(3, '0'));
  const l = s.toLowerCase();
  return BANKS.find((b) => b.name.toLowerCase() === l || b.short.toLowerCase() === l)
    ?? BANKS.find((b) => b.name.toLowerCase().includes(l) || l.includes(b.short.toLowerCase()));
}

const WEIGHTS = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];

/** CBN NUBAN check digit for a 3-digit bank code + 9-digit serial. */
export function nubanCheckDigit(bankCode: string, serial: string): number {
  const s = bankCode + serial;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * WEIGHTS[i];
  const c = 10 - (sum % 10);
  return c === 10 ? 0 : c;
}

export function isValidNuban(accountNumber: string, bankCode: string): boolean {
  if (!/^\d{10}$/.test(accountNumber) || !/^\d{3}$/.test(bankCode)) return false;
  return nubanCheckDigit(bankCode, accountNumber.slice(0, 9)) === Number(accountNumber[9]);
}

export function makeNuban(r: () => number, bankCode: string): string {
  const serial = digits(r, 9);
  return serial + nubanCheckDigit(bankCode, serial);
}
