import { Transaction } from './types';
import { userStorageKey } from './auth';
import { scheduleCloudSync } from './supabase/sync';
import { legacyWalletId } from './wallets';

const KEY = 'money_buddy_txns';

function storageKey() {
  return userStorageKey(KEY);
}

export function getTransactions(): Transaction[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey()) ?? '[]');
  } catch {
    return [];
  }
}

function save(txns: Transaction[]) {
  localStorage.setItem(storageKey(), JSON.stringify(txns));
  scheduleCloudSync();
}

export function addTransaction(txn: Transaction) {
  save([...getTransactions(), txn]);
}

export function updateTransaction(txn: Transaction) {
  save(getTransactions().map(t => t.id === txn.id ? txn : t));
}

export function deleteTransaction(id: string) {
  save(getTransactions().filter(t => t.id !== id));
}

export function clearCategoryFromTransactions(categoryId: string) {
  save(getTransactions().map(t =>
    t.categoryId === categoryId ? { ...t, categoryId: undefined } : t
  ));
}

/** Give older entries an explicit wallet, using their original GPay/Cash choice. */
export function migrateTransactionsToWallets(): boolean {
  const transactions = getTransactions();
  const updated = transactions.map(txn => txn.walletId
    ? txn
    : { ...txn, walletId: legacyWalletId(txn.paymentMode, txn.bank) }
  );
  if (updated.some((txn, index) => txn !== transactions[index])) {
    save(updated);
    return true;
  }
  return false;
}
