import { getCurrentUserId } from './auth';

const TXN_PREFIX = 'money_buddy_txns';
const SCOPED_BASES = [
  'money_buddy_txns',
  'money_buddy_wallets',
  'money_buddy_categories',
  'money_buddy_transfers',
  'money_buddy_recurring',
  'money_buddy_subscriptions',
  'money_buddy_savings_goal',
  'money_buddy_budget',
  'money_buddy_streak',
  'money_buddy_wallet_order',
  'money_buddy_notifications',
  'onboarding_done',
] as const;

export interface LocalBackup {
  id: string;
  label: string;
  transactionCount: number;
}

function parseTxnCount(raw: string | null): number {
  if (!raw) return 0;
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

function backupLabel(id: string): string {
  if (id === 'legacy') return 'Saved on this device before login';
  return `Backup from this device (${id.slice(0, 8)}…)`;
}

/** Scan localStorage for transaction data not tied to the active account. */
export function findLocalBackups(): LocalBackup[] {
  if (typeof window === 'undefined') return [];

  const currentUserId = getCurrentUserId();
  const found = new Map<string, number>();

  const legacyCount = parseTxnCount(localStorage.getItem(TXN_PREFIX));
  if (legacyCount > 0) found.set('legacy', legacyCount);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(`${TXN_PREFIX}_`)) continue;
    const sourceId = key.slice(TXN_PREFIX.length + 1);
    if (!sourceId || sourceId === currentUserId) continue;
    const count = parseTxnCount(localStorage.getItem(key));
    if (count > 0) found.set(sourceId, count);
  }

  return [...found.entries()]
    .map(([id, transactionCount]) => ({
      id,
      label: backupLabel(id),
      transactionCount,
    }))
    .sort((a, b) => b.transactionCount - a.transactionCount);
}

function sourceKey(base: string, sourceId: string): string {
  return sourceId === 'legacy' ? base : `${base}_${sourceId}`;
}

function targetKey(base: string, targetUserId: string): string {
  return `${base}_${targetUserId}`;
}

/** Copy a local backup into the signed-in account. Returns entries restored. */
export function restoreLocalBackup(sourceId: string): number {
  const targetUserId = getCurrentUserId();
  if (!targetUserId) return 0;

  const txnRaw = localStorage.getItem(sourceKey(TXN_PREFIX, sourceId));
  const count = parseTxnCount(txnRaw);
  if (!count) return 0;

  for (const base of SCOPED_BASES) {
    const value = localStorage.getItem(sourceKey(base, sourceId));
    const dest = targetKey(base, targetUserId);
    if (value != null) localStorage.setItem(dest, value);
    else localStorage.removeItem(dest);
  }

  return count;
}
