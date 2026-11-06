import { useSyncExternalStore } from 'react';
import { get, set, del } from 'idb-keyval';
import type { AppState, AuditEntry, Role } from './types';
import { sha256 } from './sha256';

const KEY = 'disbursia-state';
export const STATE_VERSION = 5;
export const GENESIS = '0'.repeat(64);

let state: AppState | null = null;
const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | undefined;

export function getState(): AppState {
  if (!state) throw new Error('Store not initialised');
  return state;
}

export function setState(updater: (s: AppState) => AppState) {
  state = updater(getState());
  listeners.forEach((l) => l());
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { void set(KEY, state); }, 250);
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getState()));
}

export async function initStore(seed: () => AppState): Promise<void> {
  let loaded: AppState | undefined;
  try { loaded = await get<AppState>(KEY); } catch { loaded = undefined; }
  if (loaded && loaded.version === STATE_VERSION) {
    state = loaded;
  } else {
    state = seed();
    try { await set(KEY, state); } catch { /* storage unavailable: run in memory */ }
  }
}

export async function resetStore(seed: () => AppState) {
  try { await del(KEY); } catch { /* ignore */ }
  state = seed();
  listeners.forEach((l) => l());
  try { await set(KEY, state); } catch { /* ignore */ }
}

// ---- Audit hash chain -------------------------------------------------------

type AuditInput = Omit<AuditEntry, 'seq' | 'prevHash' | 'hash'>;

export function hashEntry(e: Omit<AuditEntry, 'hash'>): string {
  const canonical = JSON.stringify([e.seq, e.at, e.actorId, e.actorName, e.role, e.action, e.entity, e.entityId, e.summary, e.before, e.after, e.prevHash]);
  return sha256(canonical);
}

export function chainEntry(prev: AuditEntry | undefined, input: AuditInput): AuditEntry {
  const base = { ...input, seq: (prev?.seq ?? 0) + 1, prevHash: prev?.hash ?? GENESIS };
  return { ...base, hash: hashEntry(base) };
}

export function appendAudit(
  actor: { id: string; name: string; role: Role | 'system' },
  action: string,
  entity: string,
  entityId: string,
  summary: string,
  before: Record<string, unknown> | null = null,
  after: Record<string, unknown> | null = null,
) {
  setState((s) => {
    const entry = chainEntry(s.audit[s.audit.length - 1], {
      at: new Date().toISOString(), actorId: actor.id, actorName: actor.name, role: actor.role,
      action, entity, entityId, summary, before, after,
    });
    return { ...s, audit: [...s.audit, entry] };
  });
}

export interface ChainCheck { ok: boolean; checked: number; brokenAt?: number; reason?: string }

export function verifyChain(audit: AuditEntry[]): ChainCheck {
  let prevHash = GENESIS;
  for (let i = 0; i < audit.length; i++) {
    const e = audit[i];
    if (e.seq !== i + 1) return { ok: false, checked: i, brokenAt: e.seq, reason: `Sequence gap: expected #${i + 1}, found #${e.seq}` };
    if (e.prevHash !== prevHash) return { ok: false, checked: i, brokenAt: e.seq, reason: `Entry #${e.seq} does not link to the previous entry` };
    const { hash, ...rest } = e;
    if (hashEntry(rest) !== hash) return { ok: false, checked: i, brokenAt: e.seq, reason: `Entry #${e.seq} content was altered after it was written` };
    prevHash = hash;
  }
  return { ok: true, checked: audit.length };
}
