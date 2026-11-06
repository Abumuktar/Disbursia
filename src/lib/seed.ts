import type { AppState, AuditEntry, Batch, BatchItem, Programme, TreasuryAccount, User } from './types';
import { chainEntry, STATE_VERSION } from './store';
import { generateBeneficiaries } from './sample';
import { nameEnquiry, nipTransfer } from './nibss';
import { nameSimilarity } from './names';
import { mulberry32 } from './rng';

/** SHA-256 of "u1:<PIN>". Only the hash is kept in source. */
const ADMIN_PIN_HASH = 'e14fdcad7e4867e175c38719023f1f359e26f39ca3efc182d370bbc85f392bc4';

/** The sole administrator. Face and fingerprint are enrolled on first sign-in. */
const USERS: User[] = [
  { id: 'u1', name: 'Abubakar Muktar', title: 'System Administrator', role: 'admin', phone: '', email: '', pinHash: ADMIN_PIN_HASH },
];

/**
 * Sole source account for all disbursements. Replace the account number with the
 * live Sterling Bank NUBAN before going to production.
 */
export const SOURCE_ACCOUNT: TreasuryAccount = {
  id: 'a1', name: 'Abucore Enterprises', bankCode: '232', accountNumber: '0147716203', balance: 2_500_000_000_00,
};
const ACCOUNTS: TreasuryAccount[] = [SOURCE_ACCOUNT];
/** Current available balance on the source account (kobo). */
export const OPENING_BALANCE = 18_000_000_00;

const PROGRAMMES: Programme[] = [
  { id: 'p1', code: 'PEN', name: 'Monthly Pensions', agency: 'Katsina State Pension Board', description: 'Monthly pension to retired state and local government staff.', defaultAccountId: 'a1', enrolled: 20000 },
  { id: 'p2', code: 'YEAP', name: 'YEAP Stipends', agency: 'Ministry of Youth & Sports', description: 'Youth Empowerment Programme monthly stipend to enrolled youths.', defaultAccountId: 'a1', enrolled: 5000 },
  { id: 'p3', code: 'FERT', name: 'Fertilizer Subsidy', agency: 'Ministry of Agriculture', description: 'Input subsidy credited to registered farmers per planting round.', defaultAccountId: 'a1', enrolled: 15000 },
  { id: 'p4', code: 'PHC', name: 'PHC Worker Allowances', agency: 'State Primary Health Care Agency', description: 'Monthly allowances to primary healthcare workers across 34 LGAs.', defaultAccountId: 'a1', enrolled: 5200 },
];

/** Seeded history is a pilot-sized cohort per programme so the demo stays light in the browser. */
const COHORT: Record<string, number> = { PEN: 1400, YEAP: 600, FERT: 900, PHC: 450 };

export function batchReference(code: string, when: Date, n: number) {
  const yymm = `${String(when.getFullYear()).slice(2)}${String(when.getMonth() + 1).padStart(2, '0')}`;
  return `DSB-${yymm}-${code}-${String(n).padStart(4, '0')}`;
}

export function verifyItems(items: BatchItem[], autoAccept = 0.9, review = 0.7): BatchItem[] {
  const seen = new Set<string>();
  return items.map((it) => {
    const key = `${it.bankCode}:${it.accountNumber}`;
    const dup = seen.has(key);
    seen.add(key);
    const res = nameEnquiry(it.accountNumber, it.bankCode, it.submittedName);
    if (!res.ok) return { ...it, verify: 'invalid', verifyNote: res.message, include: false, resolvedName: undefined, score: 0 };
    const score = nameSimilarity(it.submittedName, res.accountName!);
    const base = { ...it, resolvedName: res.accountName, score };
    if (dup) return { ...base, verify: 'duplicate', verifyNote: 'Account already appears earlier in this file', include: false };
    if (score >= autoAccept) return { ...base, verify: 'matched', verifyNote: 'Name confirmed by bank', include: true };
    if (score >= review) return { ...base, verify: 'review', verifyNote: 'Partial match, officer decision required', include: false };
    return { ...base, verify: 'mismatch', verifyNote: 'Bank record belongs to a different person', include: false };
  });
}

export function seedState(): AppState {
  const now = new Date();
  const batches: Batch[] = [];
  const events: Omit<AuditEntry, 'seq' | 'prevHash' | 'hash'>[] = [];
  const accounts = ACCOUNTS.map((a) => ({ ...a }));
  const u = (id: string) => USERS.find((x) => x.id === id)!;
  const ev = (at: Date, userId: string, action: string, entity: string, entityId: string, summary: string, before: Record<string, unknown> | null = null, after: Record<string, unknown> | null = null) => {
    const usr = userId === 'system' ? { id: 'system', name: 'Disbursia', role: 'system' as const } : u(userId);
    events.push({ at: at.toISOString(), actorId: usr.id, actorName: usr.name, role: usr.role, action, entity, entityId, summary, before, after });
  };
  const counter: Record<string, number> = {};
  let seed = 7;

  // Four completed months of history + one batch awaiting authorization in the current month.
  for (let back = 4; back >= 0; back--) {
    const month = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const period = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    for (const p of PROGRAMMES) {
      if (p.code === 'FERT' && back % 2 === 1) continue; // fertilizer runs every other month
      const isCurrent = back === 0;
      if (isCurrent && p.code !== 'YEAP') continue;
      const r = mulberry32(seed++);
      const day = isCurrent ? Math.max(1, Math.min(now.getDate() - 1, 3)) : 20 + Math.floor(r() * 5);
      const created = new Date(month.getFullYear(), month.getMonth(), day, 9, 10 + Math.floor(r() * 30));
      counter[p.code] = (counter[p.code] ?? 0) + 1;
      const reference = batchReference(p.code, created, counter[p.code]);
      const rows = generateBeneficiaries(p.code, isCurrent ? 400 : COHORT[p.code], 1000 + seed, 0.002);
      let items: BatchItem[] = rows.map((row, i) => ({
        id: `${reference}-${i + 1}`, row: row.row, beneficiaryId: row.beneficiaryId, accountNumber: row.accountNumber,
        bankCode: row.bankCode, submittedName: row.name, amount: row.amount, verify: 'pending', include: false,
      }));
      items = verifyItems(items);
      // Officer accepted most partial matches after checking with the programme desk.
      items = items.map((it) => (it.verify === 'review' && r() < 0.8 ? { ...it, include: true } : it));
      const acct = accounts.find((a) => a.id === p.defaultAccountId)!;
      const total = items.filter((i) => i.include).reduce((s, i) => s + i.amount, 0);
      const required = 1;
      const batch: Batch = {
        id: `b-${reference}`, reference, programmeId: p.id, accountId: acct.id,
        narration: `${p.name} ${period}`, period, fileName: `${p.code.toLowerCase()}_${period.replace(' ', '_').toLowerCase()}.xlsx`,
        createdBy: 'u1', createdAt: created.toISOString(), status: 'verified', items,
        verifiedCount: items.length, processedCount: 0, signatures: [], requiredSignatures: required,
      };
      const counts = summarize(items);
      ev(created, 'u1', 'BATCH_CREATED', 'batch', batch.id, `Uploaded ${batch.fileName} with ${items.length} rows for ${p.name}`, null, { status: 'verifying', rows: items.length });
      const verifiedAt = new Date(created.getTime() + 9000 + r() * 6000);
      ev(verifiedAt, 'system', 'BATCH_VERIFIED', 'batch', batch.id, `NIBSS name enquiry: ${counts.matched} matched, ${counts.review} partial, ${counts.mismatch} mismatched, ${counts.invalid} invalid`, { status: 'verifying' }, { status: 'verified', ...counts });
      const submitted = new Date(verifiedAt.getTime() + (4 + r() * 20) * 60000);
      batch.submittedAt = submitted.toISOString();
      batch.status = 'pending_authorization';
      ev(submitted, 'u1', 'BATCH_SUBMITTED', 'batch', batch.id, `Submitted ${counts.included} payments totalling ₦${(total / 100).toLocaleString('en-NG')} for authorization`, { status: 'verified' }, { status: 'pending_authorization', total, requiredSignatures: required });

      if (isCurrent) { batches.push(batch); continue; }

      let t = new Date(submitted.getTime() + (30 + r() * 120) * 60000);
      const signers = ['u1'];
      signers.forEach((sid, i) => {
        t = new Date(t.getTime() + i * (20 + r() * 90) * 60000);
        ev(t, sid, 'FINGERPRINT_VERIFIED', 'batch', batch.id, 'Fingerprint confirmed on the administrator\'s device');
        const tSig = new Date(t.getTime() + 40000);
        batch.signatures.push({ userId: sid, name: u(sid).name, title: u(sid).title, at: tSig.toISOString() });
        const st = i + 1 >= required ? 'processing' : 'awaiting_second_signature';
        ev(tSig, sid, 'BATCH_SIGNED', 'batch', batch.id, 'Authorized with PIN + fingerprint', { status: batch.status, signatures: i }, { status: st, signatures: i + 1 });
        batch.status = st;
        t = tSig;
      });
      const start = new Date(t.getTime() + 1000);
      batch.processingStartedAt = start.toISOString();
      ev(start, 'system', 'PAYOUT_STARTED', 'batch', batch.id, `NIP transfers started from ${acct.name}`, { status: 'processing' }, { status: 'processing' });
      let seq = 0;
      const durationMs = 40000 + r() * 50000;
      batch.items = batch.items.map((it, idx) => {
        if (!it.include) return { ...it, pay: 'excluded' };
        seq++;
        const paidAt = new Date(start.getTime() + (idx / items.length) * durationMs);
        const tx = nipTransfer(acct.bankCode, it.accountNumber, it.bankCode, 0, paidAt);
        return {
          ...it, attempts: 1, pay: tx.ok ? 'success' : 'failed', sessionId: tx.sessionId,
          reference: `${reference}/${String(seq).padStart(5, '0')}`, paidAt: paidAt.toISOString(),
          failureReason: tx.ok ? undefined : `${tx.responseCode}: ${tx.message}`,
        };
      });
      let done = new Date(start.getTime() + durationMs);
      batch.payoutCompletedAt = done.toISOString();
      const firstFailed = batch.items.filter((i) => i.pay === 'failed').length;
      // Older batches had their failed payments re-run the next morning; the latest PHC run is left for the demo.
      if (firstFailed && !(back === 1 && p.code === 'PHC')) {
        const firstPaid = batch.items.filter((i) => i.pay === 'success');
        const firstTotal = firstPaid.reduce((s, i) => s + i.amount, 0);
        ev(done, 'system', 'PAYOUT_COMPLETED', 'batch', batch.id, `${firstPaid.length} credited, ${firstFailed} failed, ₦${(firstTotal / 100).toLocaleString('en-NG')} debited in total`, { status: 'processing' }, { status: 'completed_with_failures', success: firstPaid.length, failed: firstFailed, debited: firstTotal });
        const retryAt = new Date(done.getTime() + (16 + r() * 4) * 3600000);
        ev(retryAt, signers[0], 'FINGERPRINT_VERIFIED', 'batch', batch.id, `Fingerprint confirmed to re-run failed payments on ${reference}`);
        ev(new Date(retryAt.getTime() + 35000), signers[0], 'RETRY_AUTHORIZED', 'batch', batch.id, `Re-run of ${firstFailed} failed payments authorized with PIN + fingerprint`, { status: 'completed_with_failures', failed: firstFailed }, { status: 'processing' });
        const retryDone = new Date(retryAt.getTime() + 60000);
        batch.items = batch.items.map((it) => {
          if (it.pay !== 'failed') return it;
          const tx = nipTransfer(acct.bankCode, it.accountNumber, it.bankCode, 7, retryDone);
          return { ...it, attempts: 2, pay: 'success', sessionId: tx.sessionId, paidAt: retryDone.toISOString(), failureReason: undefined };
        });
        done = retryDone;
      }
      const paid = batch.items.filter((i) => i.pay === 'success');
      const failed = batch.items.filter((i) => i.pay === 'failed').length;
      const paidTotal = paid.reduce((s, i) => s + i.amount, 0);
      acct.balance -= paidTotal;
      batch.processedCount = counts.included;
      batch.completedAt = done.toISOString();
      batch.status = failed ? 'completed_with_failures' : 'completed';
      ev(done, 'system', firstFailed && failed === 0 ? 'RETRY_COMPLETED' : 'PAYOUT_COMPLETED', 'batch', batch.id, `${paid.length} credited, ${failed} failed, ₦${(paidTotal / 100).toLocaleString('en-NG')} debited`, { status: 'processing' }, { status: batch.status, success: paid.length, failed, debited: paidTotal });
      batches.push(batch);
    }
  }

  // Opening position for the demo: the source account currently holds exactly ₦18,000,000.00.
  accounts[0].balance = OPENING_BALANCE;

  events.sort((a, b) => a.at.localeCompare(b.at));
  const audit: AuditEntry[] = [];
  for (const e of events) audit.push(chainEntry(audit[audit.length - 1], e));

  return {
    version: STATE_VERSION,
    users: USERS,
    accounts,
    programmes: PROGRAMMES,
    batches: batches.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    audit,
    settings: { secondSignatoryThreshold: 50_000_000_00, autoAcceptScore: 0.9, reviewScore: 0.7 },
    sessionUserId: null,
  };
}

export function summarize(items: BatchItem[]) {
  const c = { total: items.length, matched: 0, review: 0, mismatch: 0, invalid: 0, duplicate: 0, pending: 0, included: 0, includedAmount: 0, success: 0, failed: 0, paidAmount: 0, failedAmount: 0, queued: 0 };
  for (const it of items) {
    c[it.verify]++;
    if (it.include) { c.included++; c.includedAmount += it.amount; }
    if (it.pay === 'success') { c.success++; c.paidAmount += it.amount; }
    if (it.pay === 'failed') { c.failed++; c.failedAmount += it.amount; }
    if (it.pay === 'queued') c.queued++;
  }
  return c;
}
