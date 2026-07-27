import { Transaction, WalletTransfer } from './types';
import { userStorageKey } from './auth';
import { scheduleCloudSync } from './supabase/sync';
import { getCategoryById } from './categories';
import { getWallets, legacyWalletId, walletToPaymentMode } from './wallets';
import { addTransaction, deleteTransaction, getTransactions } from './storage';

const KEY = 'money_buddy_transfers';

function storageKey() {
  return userStorageKey(KEY);
}

export function getTransfers(): WalletTransfer[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey()) ?? '[]');
  } catch {
    return [];
  }
}

function save(transfers: WalletTransfer[]) {
  localStorage.setItem(storageKey(), JSON.stringify(transfers));
  scheduleCloudSync();
}

export function addTransfer(t: Omit<WalletTransfer, 'id' | 'createdAt'>): WalletTransfer {
  const transfer: WalletTransfer = { ...t, id: crypto.randomUUID(), createdAt: Date.now() };
  save([...getTransfers(), transfer]);
  return transfer;
}

export interface WalletTransferResult {
  transfer: WalletTransfer;
  fromWalletName?: string;
  toWalletName?: string;
}

/** Move money directly from one wallet to another. */
export function executeWalletTransfer(input: Omit<WalletTransfer, 'id' | 'createdAt' | 'expenseTxnId' | 'incomeTxnId' | 'fromCategoryId' | 'toCategoryId'>): WalletTransferResult {
  const wallets = getWallets();
  const fromWallet = wallets.find(w => w.id === input.fromWalletId);
  const toWallet = wallets.find(w => w.id === input.toWalletId);
  if (!fromWallet || !toWallet || fromWallet.id === toWallet.id) {
    throw new Error('Choose two different wallets.');
  }
  const now = Date.now();
  const expenseTxnId = crypto.randomUUID();
  const incomeTxnId = crypto.randomUUID();
  const fromPm = walletToPaymentMode(fromWallet.id);
  const toPm = walletToPaymentMode(toWallet.id);
  addTransaction({ id: expenseTxnId, type: 'expense', amount: input.amount, description: `Transfer to ${toWallet.name}`, paymentMode: fromPm.paymentMode, bank: fromPm.bank, walletId: fromWallet.id, date: input.date, createdAt: now });
  addTransaction({ id: incomeTxnId, type: 'income', amount: input.amount, description: `Transfer from ${fromWallet.name}`, paymentMode: toPm.paymentMode, bank: toPm.bank, walletId: toWallet.id, date: input.date, createdAt: now + 1 });
  const transfer = addTransfer({ ...input, expenseTxnId, incomeTxnId });
  return { transfer, fromWalletName: fromWallet.name, toWalletName: toWallet.name };
}

/** Undo a wallet transfer and reverse its paired entries. */
export function undoWalletTransfer(id: string): boolean {
  const transfer = getTransfers().find(t => t.id === id);
  if (!transfer) return false;
  if (transfer.expenseTxnId) deleteTransaction(transfer.expenseTxnId);
  if (transfer.incomeTxnId) deleteTransaction(transfer.incomeTxnId);
  deleteTransfer(id);
  return true;
}

export function deleteTransfer(id: string) {
  save(getTransfers().filter(t => t.id !== id));
}

export function clearTransfersForCategory(categoryId: string) {
  save(getTransfers().filter(t => t.fromCategoryId !== categoryId && t.toCategoryId !== categoryId));
}

/** Convert old category transfers to wallet transfers and preserve their undo history. */
export function migrateTransfersToWallets(): boolean {
  const transfers = getTransfers();
  const transactions = getTransactions();
  const wallets = getWallets();
  const fallback = wallets[0]?.id ?? 'gpay_hdfc';
  let changed = false;
  const migrated = transfers.map(transfer => {
    if (transfer.fromWalletId && transfer.toWalletId) return transfer;
    const expense = transactions.find(txn => txn.id === transfer.expenseTxnId);
    const income = transactions.find(txn => txn.id === transfer.incomeTxnId);
    const fromWalletId = getCategoryById(transfer.fromCategoryId ?? '')?.walletId
      ?? expense?.walletId ?? (expense ? legacyWalletId(expense.paymentMode, expense.bank) : fallback);
    const toWalletId = getCategoryById(transfer.toCategoryId ?? '')?.walletId
      ?? income?.walletId ?? (income ? legacyWalletId(income.paymentMode, income.bank) : fallback);
    changed = true;
    return { ...transfer, fromWalletId, toWalletId };
  });
  if (changed) save(migrated);
  return changed;
}

/** Transaction IDs created when moving money between wallets. */
export function getInternalTransferTxnIds(transfers: WalletTransfer[]): Set<string> {
  const ids = new Set<string>();
  for (const t of transfers) {
    if (t.expenseTxnId) ids.add(t.expenseTxnId);
    if (t.incomeTxnId) ids.add(t.incomeTxnId);
  }
  return ids;
}

/** Wallet moves are not real income or expense. */
export function isInternalTransferTxn(txn: Transaction, transferTxnIds?: Set<string>): boolean {
  if (transferTxnIds?.has(txn.id)) return true;
  return txn.description.startsWith('Transfer →')
    || txn.description.startsWith('Transfer ←')
    || txn.description.startsWith('Transfer to ')
    || txn.description.startsWith('Transfer from ');
}

export function sumRealIncome(transactions: Transaction[], transfers: WalletTransfer[]): number {
  const ids = getInternalTransferTxnIds(transfers);
  return transactions
    .filter(t => t.type === 'income' && !isInternalTransferTxn(t, ids))
    .reduce((s, t) => s + t.amount, 0);
}

/** Pay a credit card bill: expense from bank wallet + income to CC wallet (excluded from totals via Transfer prefix). */
export function executeCCPayment(ccWalletId: string, fromWalletId: string, amount: number, date: string): void {
  const wallets = getWallets();
  const ccWallet = wallets.find(w => w.id === ccWalletId);
  const bankWallet = wallets.find(w => w.id === fromWalletId);
  if (!ccWallet || !bankWallet) return;
  const now = Date.now();
  const fromPm = walletToPaymentMode(fromWalletId);
  const toPm = walletToPaymentMode(ccWalletId);
  addTransaction({
    id: crypto.randomUUID(),
    type: 'expense',
    amount,
    description: `Transfer → ${ccWallet.name}`,
    paymentMode: fromPm.paymentMode,
    bank: fromPm.bank,
    walletId: fromWalletId,
    date,
    createdAt: now,
  });
  addTransaction({
    id: crypto.randomUUID(),
    type: 'income',
    amount,
    description: `Transfer ← ${bankWallet.name}`,
    paymentMode: toPm.paymentMode,
    bank: toPm.bank,
    walletId: ccWalletId,
    date,
    createdAt: now + 1,
  });
}

export function sumRealExpense(transactions: Transaction[], transfers: WalletTransfer[]): number {
  const ids = getInternalTransferTxnIds(transfers);
  return transactions
    .filter(t => t.type === 'expense' && !isInternalTransferTxn(t, ids))
    .reduce((s, t) => s + t.amount, 0);
}
