/**
 * Simulated NIBSS integration (Name Enquiry + NIP Funds Transfer).
 *
 * In production these functions call the NIBSS NIP/NEFT gateway through the state's
 * sponsoring bank. The simulation is deterministic per account number so demos are
 * repeatable: a small share of accounts return a different holder, a near-miss
 * spelling, or "account not found", and a fraction of transfers fail at the
 * beneficiary bank.
 */
import { bankName, isKnownBank, isValidNuban } from './banks';
import { FIRST_NAMES, SURNAMES } from './names';
import { digits, hashString, mulberry32, pick } from './rng';

export interface NameEnquiryResult {
  ok: boolean;
  accountName?: string;
  responseCode: '00' | '07' | '25' | '91';
  message: string;
}

function misspell(name: string, r: () => number): string {
  const parts = name.split(/\s+/);
  const i = Math.floor(r() * parts.length);
  const w = parts[i];
  if (parts.length > 2 && r() < 0.5) {
    parts.splice(i, 1); // dropped middle name
  } else if (w.length > 3) {
    const j = 1 + Math.floor(r() * (w.length - 2));
    parts[i] = w.slice(0, j) + w[j + 1] + w[j] + w.slice(j + 2); // transposed letters
  }
  return parts.join(' ');
}

export function nameEnquiry(accountNumber: string, bankCode: string, submittedName: string): NameEnquiryResult {
  if (!isKnownBank(bankCode)) return { ok: false, responseCode: '91', message: `Unknown destination institution (${bankCode})` };
  if (!isValidNuban(accountNumber, bankCode)) return { ok: false, responseCode: '07', message: 'Invalid account number (NUBAN check failed)' };

  const h = hashString(`${bankCode}:${accountNumber}`);
  const bucket = h % 1000;
  const r = mulberry32(h);
  if (bucket < 4) return { ok: false, responseCode: '25', message: `No such account at ${bankName(bankCode)}` };

  let name = submittedName.trim().replace(/\s+/g, ' ');
  if (bucket < 11) {
    name = `${pick(r, FIRST_NAMES)} ${pick(r, FIRST_NAMES)} ${pick(r, SURNAMES)}`; // different account holder
  } else if (bucket < 26) {
    name = misspell(name, r); // near match, needs a human decision
  }
  // Banks return names upper case, frequently surname first.
  const parts = name.toUpperCase().split(' ');
  if (bucket % 2 === 0 && parts.length > 1) parts.unshift(parts.pop() as string);
  return { ok: true, accountName: parts.join(' '), responseCode: '00', message: 'Approved' };
}

export interface TransferResult {
  ok: boolean;
  sessionId: string;
  responseCode: string;
  message: string;
}

const FAILURES = [
  { code: '91', message: 'Beneficiary bank not available' },
  { code: '57', message: 'Transaction not permitted to beneficiary account' },
  { code: '96', message: 'System malfunction at destination bank' },
];

export function nipTransfer(sourceBank: string, accountNumber: string, bankCode: string, attempt: number, now: Date): TransferResult {
  const r = mulberry32(hashString(`${accountNumber}:${bankCode}:${attempt}:tx`));
  const ts = now.toISOString().replace(/\D/g, '').slice(2, 14);
  const sessionId = `${sourceBank}${bankCode}${ts}${digits(r, 12)}`.slice(0, 30);
  const failed = r() < (attempt === 0 ? 0.004 : 0.1);
  if (failed) {
    const f = pick(r, FAILURES);
    return { ok: false, sessionId, responseCode: f.code, message: f.message };
  }
  return { ok: true, sessionId, responseCode: '00', message: 'Approved or completed successfully' };
}
