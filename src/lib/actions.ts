import type { Batch, BatchItem, Programme, Role, SecurityProfile, User } from './types';
import { appendAudit, getState, setState } from './store';
import { sha256 } from './sha256';
import { batchReference, summarize, verifyItems } from './seed';
import { nipTransfer } from './nibss';
import type { ParsedRow } from './parse';
import { naira } from './format';

export class ActionError extends Error {}

const SYSTEM = { id: 'system', name: 'Disbursia', role: 'system' as const };

export function currentUser(): User | null {
  const s = getState();
  return s.users.find((u) => u.id === s.sessionUserId) ?? null;
}

function requireUser(...roles: Role[]): User {
  const u = currentUser();
  if (!u) throw new ActionError('You are not signed in.');
  if (roles.length && u.role !== 'admin' && !roles.includes(u.role)) throw new ActionError('Your role is not permitted to perform this action.');
  return u;
}

const actor = (u: User) => ({ id: u.id, name: u.name, role: u.role });
const getBatch = (id: string) => {
  const b = getState().batches.find((x) => x.id === id);
  if (!b) throw new ActionError('Batch not found.');
  return b;
};
function patchBatch(id: string, fn: (b: Batch) => Batch) {
  setState((s) => ({ ...s, batches: s.batches.map((b) => (b.id === id ? fn(b) : b)) }));
}
const pinOk = (u: User, pin: string) => sha256(`${u.id}:${pin}`) === u.pinHash;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Session ---------------------------------------------------------------

const SESSION_KEY = 'disbursia-session';
let pinFailures = 0;
let lockedUntil = 0;

export const admin = () => getState().users[0];

/** Record a sign-in factor result (face, fingerprint) in the audit trail. */
export function recordFactor(factor: 'face' | 'fingerprint', ok: boolean, detail = '') {
  const u = admin();
  const label = factor === 'face' ? 'Face' : 'Fingerprint';
  appendAudit(actor(u), ok ? `SIGNIN_${factor.toUpperCase()}_VERIFIED` : `SIGNIN_${factor.toUpperCase()}_FAILED`, 'session', u.id,
    ok ? `${label} verified${detail ? ` (${detail})` : ''}` : `${label} check failed${detail ? `: ${detail}` : ''}`);
}

/** Checks the administrator PIN with attempt limits; every failure is audited. */
export function checkAdminPin(pin: string) {
  const u = admin();
  if (Date.now() < lockedUntil) throw new ActionError(`Too many attempts. Try again in ${Math.ceil((lockedUntil - Date.now()) / 1000)} seconds.`);
  if (!pinOk(u, pin)) {
    pinFailures++;
    appendAudit(actor(u), 'LOGIN_FAILED', 'session', u.id, `Sign-in rejected: incorrect PIN (attempt ${pinFailures})`);
    if (pinFailures >= 5) { lockedUntil = Date.now() + 60000; pinFailures = 0; throw new ActionError('Too many incorrect PINs. Sign-in is locked for 60 seconds.'); }
    throw new ActionError('Incorrect PIN. The attempt has been logged.');
  }
  pinFailures = 0;
}

export function openSession(factors: string[]) {
  const u = admin();
  setState((s) => ({ ...s, sessionUserId: u.id }));
  try { sessionStorage.setItem(SESSION_KEY, u.id); } catch { /* ignore */ }
  appendAudit(actor(u), 'LOGIN', 'session', u.id, `Signed in with ${factors.join(' + ')}`);
}

/** Restore a session for this browser tab only; closing the tab requires a full sign-in again. */
export function restoreSession() {
  let id: string | null = null;
  try { id = sessionStorage.getItem(SESSION_KEY); } catch { /* ignore */ }
  setState((s) => ({ ...s, sessionUserId: s.users.some((u) => u.id === id) ? id : null }));
}

export function enrollSecurity(profile: Omit<SecurityProfile, 'enrolledAt'>) {
  const u = admin();
  const security: SecurityProfile = { ...profile, enrolledAt: new Date().toISOString() };
  setState((s) => ({ ...s, users: s.users.map((x) => (x.id === u.id ? { ...x, security } : x)) }));
  appendAudit(actor(u), 'SECURITY_ENROLLED', 'session', u.id,
    `Sign-in factors enrolled: ${[profile.face && 'face', profile.passkey && 'fingerprint', 'PIN'].filter(Boolean).join(', ')}`,
    null, { face: !!profile.face, fingerprint: !!profile.passkey });
}

export function resetSecurity(pin: string) {
  const u = requireUser();
  if (!pinOk(u, pin)) {
    appendAudit(actor(u), 'AUTH_FAILED', 'session', u.id, 'Biometric reset rejected: incorrect PIN');
    throw new ActionError('Incorrect PIN. The attempt has been logged.');
  }
  setState((s) => ({ ...s, users: s.users.map((x) => (x.id === u.id ? { ...x, security: undefined } : x)) }));
  appendAudit(actor(u), 'SECURITY_RESET', 'session', u.id, 'Face and fingerprint enrollment cleared; re-enrollment required at next sign-in');
  logout();
}

export function logout() {
  const u = currentUser();
  if (u) appendAudit(actor(u), 'LOGOUT', 'session', u.id, 'Signed out');
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  setState((s) => ({ ...s, sessionUserId: null }));
}

// ---- Batch creation & verification ----------------------------------------

export function createBatch(input: { programmeId: string; accountId: string; narration: string; period: string; fileName: string; rows: ParsedRow[] }): string {
  const u = requireUser('officer');
  const s = getState();
  const p = s.programmes.find((x) => x.id === input.programmeId);
  if (!p) throw new ActionError('Select a programme.');
  if (!s.accounts.some((a) => a.id === input.accountId)) throw new ActionError('Select a source account.');
  if (!input.rows.length) throw new ActionError('The file has no valid rows.');
  const now = new Date();
  const n = s.batches.filter((b) => b.programmeId === p.id).length + 1;
  const reference = batchReference(p.code, now, n);
  const items: BatchItem[] = input.rows.map((r, i) => ({
    id: `${reference}-${i + 1}`, row: r.row, beneficiaryId: r.beneficiaryId, accountNumber: r.accountNumber, bankCode: r.bankCode,
    submittedName: r.name, amount: r.amount, verify: 'pending', include: false,
  }));
  const batch: Batch = {
    id: `b-${reference}-${now.getTime().toString(36)}`, reference, programmeId: p.id, accountId: input.accountId,
    narration: input.narration.trim() || `${p.name} ${input.period}`, period: input.period, fileName: input.fileName,
    createdBy: u.id, createdAt: now.toISOString(), status: 'verifying', items, verifiedCount: 0, processedCount: 0,
    signatures: [], requiredSignatures: 1,
  };
  setState((st) => ({ ...st, batches: [batch, ...st.batches] }));
  appendAudit(actor(u), 'BATCH_CREATED', 'batch', batch.id, `Uploaded ${input.fileName} with ${items.length} rows for ${p.name}`, null, { status: 'verifying', rows: items.length, reference });
  void runVerification(batch.id);
  return batch.id;
}

const running = new Set<string>();

export async function runVerification(batchId: string) {
  if (running.has(batchId)) return;
  running.add(batchId);
  try {
    const { autoAcceptScore, reviewScore } = getState().settings;
    const total = getBatch(batchId).items.length;
    const CHUNK = Math.max(100, Math.ceil(total / 60));
    // Duplicate detection needs the whole file, so verify everything once and reveal progressively.
    const verified = verifyItems(getBatch(batchId).items, autoAcceptScore, reviewScore);
    for (let i = getBatch(batchId).verifiedCount; i < total; i += CHUNK) {
      await sleep(70);
      const upto = Math.min(total, i + CHUNK);
      patchBatch(batchId, (b) => ({ ...b, verifiedCount: upto, items: [...verified.slice(0, upto), ...b.items.slice(upto)] }));
    }
    const c = summarize(verified);
    patchBatch(batchId, (b) => ({ ...b, status: 'verified', items: verified, verifiedCount: total }));
    appendAudit(SYSTEM, 'BATCH_VERIFIED', 'batch', batchId,
      `NIBSS name enquiry: ${c.matched} matched, ${c.review} partial, ${c.mismatch} mismatched, ${c.invalid} invalid, ${c.duplicate} duplicate`,
      { status: 'verifying' }, { status: 'verified', matched: c.matched, review: c.review, mismatch: c.mismatch, invalid: c.invalid, duplicate: c.duplicate });
  } finally {
    running.delete(batchId);
  }
}

export function setItemsIncluded(batchId: string, itemIds: string[], include: boolean) {
  const u = requireUser('officer');
  const b = getBatch(batchId);
  if (b.status !== 'verified') throw new ActionError('Items can only be changed before the batch is submitted.');
  const ids = new Set(itemIds);
  const changed = b.items.filter((it) => ids.has(it.id) && (it.verify === 'review' || it.verify === 'duplicate') && it.include !== include);
  if (!changed.length) return;
  const changedIds = new Set(changed.map((c) => c.id));
  patchBatch(batchId, (bb) => ({ ...bb, items: bb.items.map((it) => (changedIds.has(it.id) ? { ...it, include } : it)) }));
  const label = changed.length === 1 ? `row ${changed[0].row} (${changed[0].submittedName} → ${changed[0].resolvedName})` : `${changed.length} rows`;
  appendAudit(actor(u), include ? 'ITEM_ACCEPTED' : 'ITEM_EXCLUDED', 'batch', batchId,
    `${include ? 'Accepted' : 'Excluded'} ${label}`,
    { include: !include, rows: changed.slice(0, 20).map((c) => c.row) }, { include, rows: changed.slice(0, 20).map((c) => c.row) });
}

export function submitBatch(batchId: string) {
  const u = requireUser('officer');
  const s = getState();
  const b = getBatch(batchId);
  if (b.status !== 'verified') throw new ActionError('Only a verified batch can be submitted.');
  const c = summarize(b.items);
  if (!c.included) throw new ActionError('No payments are included in this batch.');
  const acct = s.accounts.find((a) => a.id === b.accountId)!;
  if (acct.balance < c.includedAmount) throw new ActionError(`Insufficient balance in ${acct.name}: ${naira(acct.balance)} available, ${naira(c.includedAmount)} required.`);
  const required = 1;
  patchBatch(batchId, (bb) => ({ ...bb, status: 'pending_authorization', submittedAt: new Date().toISOString(), requiredSignatures: required }));
  appendAudit(actor(u), 'BATCH_SUBMITTED', 'batch', batchId,
    `Submitted ${c.included} payments totalling ${naira(c.includedAmount)} for authorization`,
    { status: 'verified' }, { status: 'pending_authorization', total: c.includedAmount, included: c.included, requiredSignatures: required });
}

export function cancelBatch(batchId: string) {
  const u = requireUser('officer');
  const b = getBatch(batchId);
  if (!['verified', 'verifying'].includes(b.status)) throw new ActionError('Only a draft batch can be discarded.');
  patchBatch(batchId, (bb) => ({ ...bb, status: 'cancelled' }));
  appendAudit(actor(u), 'BATCH_CANCELLED', 'batch', batchId, 'Draft batch discarded by officer', { status: b.status }, { status: 'cancelled' });
}

// ---- Authorization ---------------------------------------------------------

const otps = new Map<string, { code: string; expires: number; batchId: string; purpose: string }>();

/** Fallback second factor when no fingerprint is enrolled on this device. */
export function requestOtp(batchId: string, purpose: 'authorize' | 'retry'): { code: string } {
  const u = requireUser('signatory');
  const b = getBatch(batchId);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otps.set(u.id, { code, expires: Date.now() + 5 * 60000, batchId, purpose });
  appendAudit(actor(u), 'OTP_ISSUED', 'batch', batchId, `One-time password issued to ${purpose === 'retry' ? 're-run failed payments on' : 'authorize'} ${b.reference}`);
  return { code };
}

export type SecondFactor = { kind: 'fingerprint' } | { kind: 'otp'; code: string };

function checkCredentials(u: User, batchId: string, pin: string, second: SecondFactor, purpose: string) {
  if (!pinOk(u, pin)) {
    appendAudit(actor(u), 'AUTH_FAILED', 'batch', batchId, 'Authorization rejected: incorrect PIN');
    throw new ActionError('Incorrect PIN. The attempt has been logged.');
  }
  if (second.kind === 'fingerprint') {
    if (!u.security?.passkey) throw new ActionError('No fingerprint is enrolled on this account.');
    return;
  }
  const o = otps.get(u.id);
  if (!o || o.batchId !== batchId || o.purpose !== purpose || o.code !== second.code.trim()) {
    appendAudit(actor(u), 'AUTH_FAILED', 'batch', batchId, 'Authorization rejected: invalid one-time password');
    throw new ActionError('The one-time password is incorrect.');
  }
  if (Date.now() > o.expires) {
    otps.delete(u.id);
    throw new ActionError('The one-time password has expired. Request a new one.');
  }
  otps.delete(u.id);
}

export function canSign(u: User | null, b: Batch): { ok: boolean; reason?: string } {
  if (!u || (u.role !== 'admin' && u.role !== 'signatory')) return { ok: false, reason: 'Only the administrator can authorize payments.' };
  if (!['pending_authorization', 'awaiting_second_signature'].includes(b.status)) return { ok: false, reason: 'This batch is not awaiting authorization.' };
  if (u.role !== 'admin' && b.createdBy === u.id) return { ok: false, reason: 'Segregation of duties: you prepared this batch and cannot authorize it.' };
  if (b.signatures.some((s) => s.userId === u.id)) return { ok: false, reason: 'You have already authorized this batch.' };
  return { ok: true };
}

export function authorizeBatch(batchId: string, pin: string, second: SecondFactor) {
  const u = requireUser('signatory');
  const b = getBatch(batchId);
  const can = canSign(u, b);
  if (!can.ok) throw new ActionError(can.reason);
  checkCredentials(u, batchId, pin, second, 'authorize');
  const s = getState();
  const acct = s.accounts.find((a) => a.id === b.accountId)!;
  const c = summarize(b.items);
  if (acct.balance < c.includedAmount) throw new ActionError(`Insufficient balance in ${acct.name}.`);
  const sigs = [...b.signatures, { userId: u.id, name: u.name, title: u.title, at: new Date().toISOString() }];
  const complete = sigs.length >= b.requiredSignatures;
  const status = complete ? 'processing' : 'awaiting_second_signature';
  const method = second.kind === 'fingerprint' ? 'PIN + fingerprint' : 'PIN + OTP';
  patchBatch(batchId, (bb) => ({ ...bb, signatures: sigs, status }));
  appendAudit(actor(u), 'BATCH_SIGNED', 'batch', batchId, `Authorized with ${method}`,
    { status: b.status, signatures: b.signatures.length }, { status, signatures: sigs.length });
  if (complete) void runPayout(batchId);
}

export function rejectBatch(batchId: string, pin: string, reason: string) {
  const u = requireUser('signatory');
  const b = getBatch(batchId);
  if (!['pending_authorization', 'awaiting_second_signature'].includes(b.status)) throw new ActionError('This batch is not awaiting authorization.');
  if (reason.trim().length < 10) throw new ActionError('Give a reason of at least 10 characters. It is sent back to the preparing officer.');
  if (!pinOk(u, pin)) {
    appendAudit(actor(u), 'AUTH_FAILED', 'batch', batchId, 'Rejection not recorded: incorrect PIN');
    throw new ActionError('Incorrect PIN. The attempt has been logged.');
  }
  patchBatch(batchId, (bb) => ({ ...bb, status: 'rejected', rejection: { by: u.name, at: new Date().toISOString(), reason: reason.trim() } }));
  appendAudit(actor(u), 'BATCH_REJECTED', 'batch', batchId, `Rejected: ${reason.trim()}`, { status: b.status }, { status: 'rejected' });
}

// ---- Payout ----------------------------------------------------------------

export async function runPayout(batchId: string, retry = false) {
  if (running.has(batchId)) return;
  running.add(batchId);
  try {
    const b0 = getBatch(batchId);
    const acct0 = getState().accounts.find((a) => a.id === b0.accountId)!;
    const startedAt = new Date().toISOString();
    if (!retry) {
      patchBatch(batchId, (b) => ({
        ...b, status: 'processing', processingStartedAt: b.processingStartedAt ?? startedAt,
        items: b.items.map((it) => (it.pay ? it : { ...it, pay: it.include ? 'queued' : 'excluded' })),
      }));
      if (!b0.processingStartedAt) appendAudit(SYSTEM, 'PAYOUT_STARTED', 'batch', batchId, `NIP transfers started from ${acct0.name}`, { status: b0.status }, { status: 'processing' });
    }
    let seq = getBatch(batchId).items.filter((i) => i.reference).length;
    const queue = getBatch(batchId).items.map((it, idx) => ({ it, idx })).filter((x) => x.it.pay === 'queued');
    const CHUNK = Math.max(50, Math.ceil(queue.length / 50));
    for (let i = 0; i < queue.length; i += CHUNK) {
      await sleep(90);
      const slice = queue.slice(i, i + CHUNK);
      const now = new Date();
      let debit = 0;
      const updates = new Map<number, BatchItem>();
      for (const { it, idx } of slice) {
        const attempt = it.attempts ?? 0;
        const tx = nipTransfer(acct0.bankCode, it.accountNumber, it.bankCode, attempt, now);
        const reference = it.reference ?? `${b0.reference}/${String(++seq).padStart(5, '0')}`;
        if (tx.ok) debit += it.amount;
        updates.set(idx, {
          ...it, attempts: attempt + 1, pay: tx.ok ? 'success' : 'failed', sessionId: tx.sessionId, reference,
          paidAt: now.toISOString(), failureReason: tx.ok ? undefined : `${tx.responseCode}: ${tx.message}`,
        });
      }
      setState((s) => ({
        ...s,
        accounts: s.accounts.map((a) => (a.id === b0.accountId ? { ...a, balance: a.balance - debit } : a)),
        batches: s.batches.map((b) => (b.id !== batchId ? b : {
          ...b, items: b.items.map((it, idx) => updates.get(idx) ?? it),
          processedCount: b.items.filter((x, idx) => (updates.get(idx) ?? x).pay === 'success' || (updates.get(idx) ?? x).pay === 'failed').length,
        })),
      }));
    }
    const b = getBatch(batchId);
    const c = summarize(b.items);
    const status = c.failed ? 'completed_with_failures' : 'completed';
    const nowIso = new Date().toISOString();
    patchBatch(batchId, (bb) => ({ ...bb, status, completedAt: nowIso, payoutCompletedAt: bb.payoutCompletedAt ?? nowIso }));
    appendAudit(SYSTEM, retry ? 'RETRY_COMPLETED' : 'PAYOUT_COMPLETED', 'batch', batchId,
      `${c.success} credited, ${c.failed} failed, ${naira(c.paidAmount)} debited in total`,
      { status: retry ? 'completed_with_failures' : 'processing' }, { status, success: c.success, failed: c.failed, debited: c.paidAmount });
  } finally {
    running.delete(batchId);
  }
}

export function retryFailed(batchId: string, pin: string, second: SecondFactor) {
  const u = requireUser('signatory');
  const b = getBatch(batchId);
  if (b.status !== 'completed_with_failures') throw new ActionError('There are no failed payments to re-run.');
  checkCredentials(u, batchId, pin, second, 'retry');
  const failed = b.items.filter((i) => i.pay === 'failed');
  patchBatch(batchId, (bb) => ({ ...bb, status: 'processing', items: bb.items.map((i) => (i.pay === 'failed' ? { ...i, pay: 'queued' } : i)) }));
  appendAudit(actor(u), 'RETRY_AUTHORIZED', 'batch', batchId, `Re-run of ${failed.length} failed payments authorized with ${second.kind === 'fingerprint' ? 'PIN + fingerprint' : 'PIN + OTP'}`, { status: b.status, failed: failed.length }, { status: 'processing' });
  void runPayout(batchId, true);
}

export function logEvent(action: string, entity: string, entityId: string, summary: string) {
  const u = currentUser();
  if (u) appendAudit(actor(u), action, entity, entityId, summary);
}

/** Resume work interrupted by a page reload. */
export function resumeInFlight() {
  for (const b of getState().batches) {
    if (b.status === 'verifying') void runVerification(b.id);
    if (b.status === 'processing') void runPayout(b.id, !!b.completedAt);
  }
}

export function createProgramme(input: { code: string; name: string; agency: string; description: string; enrolled: number; standardAmount: number }): Programme {
  const u = requireUser('officer');
  const s = getState();
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z]{2,6}$/.test(code)) throw new ActionError('Code must be 2 to 6 letters, for example SCHL.');
  if (s.programmes.some((p) => p.code === code)) throw new ActionError(`A programme with code ${code} already exists.`);
  if (input.name.trim().length < 3) throw new ActionError('Enter the programme name.');
  if (input.agency.trim().length < 3) throw new ActionError('Enter the implementing ministry or agency.');
  if (!(input.enrolled > 0)) throw new ActionError('Enter the number of enrolled beneficiaries.');
  if (!(input.standardAmount > 0)) throw new ActionError('Enter the usual amount paid to each beneficiary.');
  const p: Programme = {
    id: `p-${code.toLowerCase()}-${Date.now().toString(36)}`, code, name: input.name.trim(), agency: input.agency.trim(),
    description: input.description.trim(), defaultAccountId: s.accounts[0].id, enrolled: Math.round(input.enrolled),
    standardAmount: Math.round(input.standardAmount), createdAt: new Date().toISOString(),
  };
  setState((st) => ({ ...st, programmes: [...st.programmes, p] }));
  appendAudit(actor(u), 'PROGRAMME_CREATED', 'programme', p.id, `Added programme ${p.name} (${p.code}) for ${p.agency}`, null,
    { code: p.code, name: p.name, enrolled: p.enrolled, standardAmount: p.standardAmount });
  return p;
}
