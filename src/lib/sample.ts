import { BANKS, makeNuban } from './banks';
import { FIRST_NAMES, SURNAMES } from './names';
import { mulberry32, pick } from './rng';
import type { ParsedRow } from './parse';

/** Banks weighted towards those with the largest footprint in Katsina State. */
const WEIGHTED_BANKS = ['011', '011', '033', '033', '057', '044', '058', '301', '301', '215', '070', '232', '035', '214', '082', '076'];

export interface ProgrammeProfile { prefix: string; amount: (r: () => number) => number }

export const PROFILES: Record<string, ProgrammeProfile> = {
  PEN: { prefix: 'KTPB', amount: (r) => Math.round((22000 + r() * r() * 160000) / 50) * 50 * 100 },
  YEAP: { prefix: 'YEAP', amount: () => 30000 * 100 },
  FERT: { prefix: 'FSR', amount: (r) => (r() < 0.7 ? 45000 : 90000) * 100 },
  PHC: { prefix: 'PHC', amount: (r) => (r() < 0.6 ? 25000 : 35000) * 100 },
};

export function generateBeneficiaries(programmeCode: string, count: number, seed: number, invalidRate = 0.003, standardAmount?: number): ParsedRow[] {
  const r = mulberry32(seed);
  const profile = PROFILES[programmeCode] ?? { prefix: programmeCode, amount: () => standardAmount ?? 25000_00 };
  const rows: ParsedRow[] = [];
  for (let i = 0; i < count; i++) {
    const bankCode = pick(r, WEIGHTED_BANKS);
    let acct = makeNuban(r, bankCode);
    if (r() < invalidRate) acct = acct.slice(0, 9) + ((Number(acct[9]) + 3) % 10); // typo'd digit
    const middle = r() < 0.45 ? ` ${pick(r, FIRST_NAMES)}` : '';
    rows.push({
      row: i + 2,
      beneficiaryId: `${profile.prefix}/${String(i + 1).padStart(6, '0')}`,
      accountNumber: acct,
      bankCode,
      name: `${pick(r, FIRST_NAMES)}${middle} ${pick(r, SURNAMES)}`,
      amount: profile.amount(r),
    });
  }
  return rows;
}

export const BANK_LIST = BANKS;
