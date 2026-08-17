import { RecurringRule, Transaction, Frequency } from './types';
import { addTransaction, getTransactions, updateTransaction, deleteTransaction } from './storage';
import { walletToPaymentMode } from './wallets';
import { userStorageKey } from './auth';
import { scheduleCloudSync } from './supabase/sync';

const KEY = 'money_buddy_recurring';

function storageKey() {
  return userStorageKey(KEY);
}

/** Local calendar YYYY-MM-DD (avoids UTC midnight drift). */
function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function getRules(): RecurringRule[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(storageKey()) ?? '[]'); } catch { return []; }
}

function save(rules: RecurringRule[]) {
  localStorage.setItem(storageKey(), JSON.stringify(rules));
  scheduleCloudSync();
}

export function addRule(rule: RecurringRule) {
  save([...getRules(), rule]);
}

export function updateRule(id: string, patch: Partial<RecurringRule>) {
  save(getRules().map(r => (r.id === id ? { ...r, ...patch } : r)));
}

export function deleteRule(id: string) {
  save(getRules().filter(r => r.id !== id));
}

export function findRuleForTransaction(txn: Transaction): RecurringRule | undefined {
  const rules = getRules();
  if (txn.recurringRuleId) return rules.find(r => r.id === txn.recurringRuleId);
  const linked = rules.find(r => r.linkedTransactionId === txn.id);
  if (linked) return linked;
  const walletId = txn.walletId;
  return rules.find(r =>
    r.type === txn.type &&
    r.amount === txn.amount &&
    r.description === txn.description &&
    r.walletId === walletId &&
    (r.categoryId ?? '') === (txn.categoryId ?? ''),
  );
}

export function computeNextDue(fromDate: string, frequency: Frequency): string {
  const d = parseLocalDate(fromDate);
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return localDateKey(d);
}

function advance(dateStr: string, freq: RecurringRule['frequency']): string {
  return computeNextDue(dateStr, freq);
}

/** Save or update recurring rule linked to a transaction. */
export function syncRuleForTransaction(
  txn: Transaction,
  recurring: boolean,
  frequency: Frequency,
): Transaction {
  const existing = findRuleForTransaction(txn);
  const catId = (txn.type === 'income' || txn.type === 'expense') && txn.categoryId ? txn.categoryId : undefined;

  if (!recurring) {
    if (existing) deleteRule(existing.id);
    const updated = { ...txn, recurringRuleId: undefined };
    updateTransaction(updated);
    return updated;
  }

  const nextDue = existing?.nextDue ?? computeNextDue(txn.date, frequency);

  if (existing) {
    updateRule(existing.id, {
      type: txn.type,
      amount: txn.amount,
      description: txn.description,
      walletId: txn.walletId!,
      categoryId: catId,
      frequency,
      nextDue,
      linkedTransactionId: txn.id,
    });
    const updated = { ...txn, recurringRuleId: existing.id };
    updateTransaction(updated);
    return updated;
  }

  const ruleId = crypto.randomUUID();
  addRule({
    id: ruleId,
    type: txn.type,
    amount: txn.amount,
    description: txn.description,
    walletId: txn.walletId!,
    categoryId: catId,
    frequency,
    nextDue,
    linkedTransactionId: txn.id,
  });
  const updated = { ...txn, recurringRuleId: ruleId };
  updateTransaction(updated);
  return updated;
}

/**
 * Remove duplicate auto-generated recurring rows (same rule + date),
 * keeping the earliest createdAt. Returns how many were deleted.
 */
export function dedupeRecurringTransactions(): number {
  const txns = getTransactions();
  const keep = new Map<string, string>();
  const remove: string[] = [];

  const sorted = [...txns].sort((a, b) => a.createdAt - b.createdAt);
  for (const t of sorted) {
    if (!t.recurringRuleId) continue;
    const key = `${t.recurringRuleId}|${t.date.slice(0, 10)}`;
    if (keep.has(key)) remove.push(t.id);
    else keep.set(key, t.id);
  }

  for (const id of remove) deleteTransaction(id);
  return remove.length;
}

/** Call on app load — auto-adds overdue entries once per due date, advances nextDue. */
export function applyDueRecurring(): number {
  const today = localDateKey();
  const rules = getRules();
  if (!rules.length) return 0;

  const existing = getTransactions();
  const seen = new Set(
    existing
      .filter(t => t.recurringRuleId)
      .map(t => `${t.recurringRuleId}|${t.date.slice(0, 10)}`),
  );

  let count = 0;
  const updated = rules.map(rule => {
    let r = { ...rule };
    let guard = 0;
    while (r.nextDue.slice(0, 10) <= today && guard++ < 400) {
      const due = r.nextDue.slice(0, 10);
      const key = `${r.id}|${due}`;
      if (!seen.has(key)) {
        const pm = walletToPaymentMode(r.walletId);
        addTransaction({
          id: crypto.randomUUID(),
          type: r.type,
          amount: r.amount,
          description: r.description,
          walletId: r.walletId,
          categoryId: r.categoryId,
          recurringRuleId: r.id,
          paymentMode: pm.paymentMode,
          bank: pm.bank,
          date: due,
          createdAt: Date.now(),
        } as Transaction);
        seen.add(key);
        count++;
      }
      r = { ...r, nextDue: advance(due, r.frequency) };
    }
    return r;
  });

  save(updated);
  return count;
}
