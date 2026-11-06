import { appendAudit, getState, setState } from './store';
import { naira } from './format';

/**
 * Credits to the source account. Each entry is applied exactly once per browser
 * (tracked in state.appliedFunding) and recorded in the audit trail.
 */
export const FUNDING: { id: string; amount: number; note: string }[] = [
  { id: 'topup-2026-11-06-10m', amount: 10_000_000_00, note: 'Top-up of ₦10,000,000.00' },
];

export function applyFunding() {
  for (const f of FUNDING) {
    const s = getState();
    if (s.appliedFunding?.includes(f.id)) continue;
    const acct = s.accounts[0];
    const before = acct.balance;
    setState((st) => ({
      ...st,
      appliedFunding: [...(st.appliedFunding ?? []), f.id],
      accounts: st.accounts.map((a) => (a.id === acct.id ? { ...a, balance: a.balance + f.amount } : a)),
    }));
    appendAudit({ id: 'system', name: 'Disbursia', role: 'system' }, 'ACCOUNT_FUNDED', 'account', acct.id,
      `${naira(f.amount)} credited to ${acct.name} (${f.note})`, { balance: before }, { balance: before + f.amount });
  }
}
