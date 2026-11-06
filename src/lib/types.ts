export type Role = 'admin' | 'officer' | 'signatory' | 'auditor';

export interface SecurityProfile {
  /** 128-number face descriptor captured at enrollment */
  face?: number[];
  /** WebAuthn platform credential (laptop fingerprint) */
  passkey?: { id: string; publicKey: string; alg: number };
  enrolledAt: string;
}

export interface User {
  id: string;
  name: string;
  title: string;
  role: Role;
  phone: string;
  email: string;
  pinHash: string;
  security?: SecurityProfile;
}

export interface TreasuryAccount {
  id: string;
  name: string;
  bankCode: string;
  accountNumber: string;
  /** Balance in kobo */
  balance: number;
}

export interface Programme {
  id: string;
  code: string;
  name: string;
  agency: string;
  description: string;
  defaultAccountId: string;
  enrolled: number;
}

export type VerifyStatus = 'pending' | 'matched' | 'review' | 'mismatch' | 'invalid' | 'duplicate';
export type PayStatus = 'queued' | 'success' | 'failed' | 'excluded';

export interface BatchItem {
  id: string;
  row: number;
  beneficiaryId?: string;
  accountNumber: string;
  bankCode: string;
  submittedName: string;
  resolvedName?: string;
  /** 0..1 similarity between submitted and resolved name */
  score?: number;
  /** Amount in kobo */
  amount: number;
  verify: VerifyStatus;
  verifyNote?: string;
  include: boolean;
  pay?: PayStatus;
  failureReason?: string;
  sessionId?: string;
  reference?: string;
  paidAt?: string;
  attempts?: number;
}

export type BatchStatus =
  | 'verifying'
  | 'verified'
  | 'pending_authorization'
  | 'awaiting_second_signature'
  | 'processing'
  | 'completed'
  | 'completed_with_failures'
  | 'rejected'
  | 'cancelled';

export interface Signature {
  userId: string;
  name: string;
  title: string;
  at: string;
}

export interface Batch {
  id: string;
  reference: string;
  programmeId: string;
  accountId: string;
  narration: string;
  period: string;
  fileName: string;
  createdBy: string;
  createdAt: string;
  submittedAt?: string;
  status: BatchStatus;
  items: BatchItem[];
  verifiedCount: number;
  processedCount: number;
  signatures: Signature[];
  requiredSignatures: number;
  rejection?: { by: string; at: string; reason: string };
  processingStartedAt?: string;
  completedAt?: string;
  /** End of the first payout run (excludes later re-runs of failed payments) */
  payoutCompletedAt?: string;
}

export interface AuditEntry {
  seq: number;
  at: string;
  actorId: string;
  actorName: string;
  role: Role | 'system';
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  prevHash: string;
  hash: string;
}

export interface Settings {
  /** kobo */
  secondSignatoryThreshold: number;
  autoAcceptScore: number;
  reviewScore: number;
}

export interface AppState {
  version: number;
  users: User[];
  accounts: TreasuryAccount[];
  programmes: Programme[];
  batches: Batch[];
  audit: AuditEntry[];
  settings: Settings;
  sessionUserId: string | null;
}
