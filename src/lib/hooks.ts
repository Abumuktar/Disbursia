import { useMemo } from 'react';
import { useAppState } from './store';
import { summarize } from './seed';
import type { Batch } from './types';

export const useMe = () => useAppState((s) => s.users.find((u) => u.id === s.sessionUserId)!);

const cache = new WeakMap<Batch, ReturnType<typeof summarize>>();
export function batchSummary(b: Batch) {
  let c = cache.get(b);
  if (!c) { c = summarize(b.items); cache.set(b, c); }
  return c;
}

export function useLookups() {
  const programmes = useAppState((s) => s.programmes);
  const users = useAppState((s) => s.users);
  const accounts = useAppState((s) => s.accounts);
  return useMemo(() => ({
    programme: (id: string) => programmes.find((p) => p.id === id)!,
    user: (id: string) => users.find((u) => u.id === id),
    account: (id: string) => accounts.find((a) => a.id === id)!,
  }), [programmes, users, accounts]);
}
