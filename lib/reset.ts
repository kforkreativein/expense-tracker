import { userStorageKey, getCurrentUserId } from './auth';
import { pushToCloud } from './supabase/sync';

/**
 * Everything that counts as a record of money moving. Wallets, types, spending
 * categories and preferences are deliberately kept — those are the setup the
 * user built, not the history they asked to clear.
 */
const DATA_KEYS = [
  'money_buddy_txns',
  'money_buddy_transfers',
  'money_buddy_recurring',
  'money_buddy_splits',
  'money_buddy_savings_goal',
  'money_buddy_budget',
  'money_buddy_streak',
  'money_buddy_cc_reminders_dismissed',
  'money_buddy_cc_reminders_notified',
] as const;

const RESET_FLAG = 'money_buddy_reset_done';

/** True once this account has been reset, so old backups stop being offered. */
export function wasReset(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(userStorageKey(RESET_FLAG)) === '1';
  } catch {
    return false;
  }
}

export interface ResetOutcome {
  /** False when the cloud copy could not be cleared (offline, for example). */
  cloudCleared: boolean;
}

/**
 * Wipes every entry, transfer, recurring rule and split group for the signed-in
 * account, on this device and in the cloud.
 *
 * The cloud push matters: clearing only localStorage would let the next sync
 * pull everything straight back.
 */
export async function resetAllData(): Promise<ResetOutcome> {
  const userId = getCurrentUserId();

  for (const base of DATA_KEYS) {
    try {
      localStorage.removeItem(userStorageKey(base));
      // Pre-login copies were migrated into the account, so they go too —
      // otherwise the recovery banner offers the cleared data straight back
      if (userId) localStorage.removeItem(base);
    } catch {
      // a key we cannot remove must not stop the rest of the reset
    }
  }

  try {
    localStorage.setItem(userStorageKey(RESET_FLAG), '1');
  } catch {
    // the flag is only a nicety
  }

  try {
    await pushToCloud();
    return { cloudCleared: true };
  } catch (err) {
    console.error('cloud wipe after reset failed', err);
    return { cloudCleared: false };
  }
}
