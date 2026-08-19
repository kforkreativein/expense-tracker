import { TxType, Transaction } from './types';
import { userStorageKey } from './auth';
import { scheduleCloudSync } from './supabase/sync';
import { addTransaction, getTransactions, deleteTransaction } from './storage';
import { walletToPaymentMode } from './wallets';

export type SubCycle = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type SubList = 'personal' | 'business' | 'all';
export type SubCategory =
  | 'streaming'
  | 'music'
  | 'productivity'
  | 'cloud'
  | 'fitness'
  | 'news'
  | 'shopping'
  | 'finance'
  | 'other';

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  cycle: SubCycle;
  list: 'personal' | 'business';
  category: SubCategory;
  firstPayment: string; // YYYY-MM-DD
  nextPayment: string;
  duration: 'forever' | string;
  freeTrial: boolean;
  notifyDaysBefore: number;
  emoji: string;
  color: string;
  cancelled: boolean;
  subscribedAt: string;
  /**
   * Set all three to auto-add a transaction every cycle (replaces the old
   * recurring rules). Leave unset and this stays a renewal reminder only.
   */
  type?: TxType;
  walletId?: string;
  /** Type/pocket (Personal, Business, …) for the auto-added transaction */
  categoryId?: string;
  history: { date: string; note: string }[];
  createdAt: number;
}

export interface CatalogItem {
  name: string;
  emoji: string;
  color: string;
  category: SubCategory;
  defaultAmount?: number;
}

const KEY = 'money_buddy_subscriptions';

function storageKey() {
  return userStorageKey(KEY);
}

export const STREAMING_CATALOG: CatalogItem[] = [
  { name: 'Netflix', emoji: '🎬', color: '#E50914', category: 'streaming', defaultAmount: 649 },
  { name: 'YouTube Premium', emoji: '▶️', color: '#FF0000', category: 'streaming', defaultAmount: 129 },
  { name: 'Amazon Prime Video', emoji: '📦', color: '#00A8E1', category: 'streaming', defaultAmount: 299 },
  { name: 'Disney+', emoji: '✨', color: '#113CCF', category: 'streaming', defaultAmount: 299 },
  { name: 'Hotstar', emoji: '📺', color: '#1B1B2F', category: 'streaming', defaultAmount: 299 },
  { name: 'Apple TV+', emoji: '🍎', color: '#A2AAAD', category: 'streaming', defaultAmount: 99 },
  { name: 'Spotify', emoji: '🎧', color: '#1DB954', category: 'music', defaultAmount: 59 },
  { name: 'Apple Music', emoji: '🎵', color: '#FC3C44', category: 'music', defaultAmount: 99 },
  { name: 'iCloud+', emoji: '☁️', color: '#3B82F6', category: 'cloud', defaultAmount: 75 },
  { name: 'Google One', emoji: '💾', color: '#4285F4', category: 'cloud', defaultAmount: 130 },
  { name: 'ChatGPT Plus', emoji: '🤖', color: '#10A37F', category: 'productivity', defaultAmount: 1650 },
  { name: 'Cursor', emoji: '⌨️', color: '#7C3AED', category: 'productivity', defaultAmount: 1650 },
  { name: 'Notion', emoji: '📝', color: '#ffffff', category: 'productivity', defaultAmount: 800 },
  { name: 'Canva Pro', emoji: '🎨', color: '#00C4CC', category: 'productivity', defaultAmount: 500 },
];

const NAME_HINTS: { keys: string[]; category: SubCategory }[] = [
  { keys: ['netflix', 'hotstar', 'disney', 'prime video', 'youtube', 'hulu', 'hbo', 'apple tv'], category: 'streaming' },
  { keys: ['spotify', 'apple music', 'youtube music', 'gaana', 'jiosaavn'], category: 'music' },
  { keys: ['icloud', 'google one', 'dropbox', 'onedrive'], category: 'cloud' },
  { keys: ['chatgpt', 'cursor', 'notion', 'canva', 'figma', 'adobe', 'github'], category: 'productivity' },
  { keys: ['gym', 'cult', 'fit', 'healthify'], category: 'fitness' },
  { keys: ['times', 'hindu', 'medium', 'substack'], category: 'news' },
];

export function guessSubCategory(name: string): SubCategory {
  const n = name.toLowerCase();
  for (const hint of NAME_HINTS) {
    if (hint.keys.some(k => n.includes(k))) return hint.category;
  }
  return 'other';
}

export function getSubscriptions(): Subscription[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey()) ?? '[]');
  } catch {
    return [];
  }
}

function save(list: Subscription[]) {
  localStorage.setItem(storageKey(), JSON.stringify(list));
  scheduleCloudSync();
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Advance a date by one billing cycle. */
export function advanceCycle(iso: string, cycle: SubCycle): string {
  if (cycle === 'daily') return addDays(iso, 1);
  if (cycle === 'weekly') return addDays(iso, 7);
  if (cycle === 'yearly') return addDays(iso, 365);
  const d = new Date(iso + 'T12:00:00');
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function nextPaymentFrom(first: string, cycle: SubCycle, from = localToday()): string {
  let next = first;
  let guard = 0;
  while (next < from && guard < 600) {
    next = advanceCycle(next, cycle);
    guard += 1;
  }
  return next;
}

export function yearlyCost(sub: Subscription): number {
  if (sub.cancelled) return 0;
  if (sub.cycle === 'daily') return sub.amount * 365;
  if (sub.cycle === 'weekly') return sub.amount * 52;
  if (sub.cycle === 'yearly') return sub.amount;
  return sub.amount * 12;
}

export function daysUntil(iso: string): number {
  const a = new Date(localToday() + 'T12:00:00').getTime();
  const b = new Date(iso + 'T12:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

export function addSubscription(input: Omit<Subscription, 'id' | 'createdAt' | 'history' | 'nextPayment' | 'subscribedAt'> & {
  nextPayment?: string;
  history?: Subscription['history'];
  subscribedAt?: string;
}): Subscription {
  const nextPayment = input.nextPayment ?? nextPaymentFrom(input.firstPayment, input.cycle);
  const sub: Subscription = {
    ...input,
    id: crypto.randomUUID(),
    nextPayment,
    subscribedAt: input.subscribedAt ?? input.firstPayment,
    history: input.history ?? [{ date: input.firstPayment, note: 'Subscribed' }],
    createdAt: Date.now(),
  };
  save([...getSubscriptions(), sub]);
  return sub;
}

export function updateSubscription(id: string, patch: Partial<Subscription>) {
  save(getSubscriptions().map(s => (s.id === id ? { ...s, ...patch } : s)));
}

export function deleteSubscription(id: string) {
  save(getSubscriptions().filter(s => s.id !== id));
}

export function cancelSubscription(id: string) {
  const s = getSubscriptions().find(x => x.id === id);
  if (!s) return;
  updateSubscription(id, {
    cancelled: true,
    history: [...s.history, { date: localToday(), note: 'Marked as cancelled' }],
  });
}

/**
 * Call on app load — for every active subscription with a type + wallet set,
 * auto-adds a transaction for each due cycle and advances nextPayment.
 * Subscriptions without a wallet stay pure renewal reminders (no transaction).
 */
export function applyDueSubscriptions(): number {
  const today = localToday();
  const subs = getSubscriptions();
  if (!subs.length) return 0;

  const existing = getTransactions();
  const seen = new Set(
    existing.filter(t => t.subscriptionId).map(t => `${t.subscriptionId}|${t.date.slice(0, 10)}`),
  );

  let count = 0;
  const updated = subs.map(s => {
    if (s.cancelled || !s.type || !s.walletId) return s;
    let sub = { ...s };
    let guard = 0;
    while (sub.nextPayment <= today && guard++ < 400) {
      const dueDate = sub.nextPayment;
      const key = `${sub.id}|${dueDate}`;
      if (!seen.has(key)) {
        const pm = walletToPaymentMode(sub.walletId!);
        addTransaction({
          id: crypto.randomUUID(),
          type: sub.type!,
          amount: sub.amount,
          description: sub.name,
          walletId: sub.walletId,
          categoryId: sub.categoryId,
          subscriptionId: sub.id,
          paymentMode: pm.paymentMode,
          bank: pm.bank,
          date: dueDate,
          createdAt: Date.now(),
        } as Transaction);
        seen.add(key);
        count++;
      }
      sub = { ...sub, nextPayment: advanceCycle(dueDate, sub.cycle) };
    }
    return sub;
  });

  save(updated);
  return count;
}

/** Remove duplicate auto-added subscription transactions (same sub + date), keeping the earliest. */
export function dedupeSubscriptionTransactions(): number {
  const txns = getTransactions();
  const keep = new Map<string, string>();
  const remove: string[] = [];

  const sorted = [...txns].sort((a, b) => a.createdAt - b.createdAt);
  for (const t of sorted) {
    if (!t.subscriptionId) continue;
    const key = `${t.subscriptionId}|${t.date.slice(0, 10)}`;
    if (keep.has(key)) remove.push(t.id);
    else keep.set(key, t.id);
  }

  for (const id of remove) deleteTransaction(id);
  return remove.length;
}

interface LegacyRecurringRule {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  walletId: string;
  categoryId?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  nextDue: string;
}

const LEGACY_RECURRING_KEY = 'money_buddy_recurring';

/**
 * One-time move: recurring rules become subscriptions. Reuses each rule's id
 * as the new subscription id, so this is safe to run on more than one device
 * or more than once — a rule that already has a matching subscription is
 * skipped. Clears the legacy local key once absorbed.
 */
export function migrateRecurringToSubscriptions(): number {
  if (typeof window === 'undefined') return 0;
  let rules: LegacyRecurringRule[] = [];
  try {
    rules = JSON.parse(localStorage.getItem(userStorageKey(LEGACY_RECURRING_KEY)) ?? '[]');
  } catch {
    rules = [];
  }
  if (!rules.length) return 0;

  const existingIds = new Set(getSubscriptions().map(s => s.id));
  const toAdd = rules.filter(r => !existingIds.has(r.id));
  if (toAdd.length) {
    const migrated: Subscription[] = toAdd.map(r => ({
      id: r.id,
      name: r.description || (r.type === 'income' ? 'Recurring income' : r.type === 'investment' ? 'Recurring investment' : 'Recurring expense'),
      amount: r.amount,
      currency: 'INR',
      cycle: r.frequency,
      list: 'personal',
      category: guessSubCategory(r.description || ''),
      firstPayment: r.nextDue,
      nextPayment: r.nextDue,
      duration: 'forever',
      freeTrial: false,
      notifyDaysBefore: 1,
      emoji: r.type === 'income' ? '💰' : r.type === 'investment' ? '📈' : '🔄',
      color: r.type === 'income' ? '#10B981' : r.type === 'investment' ? '#3B82F6' : '#7C3AED',
      cancelled: false,
      subscribedAt: r.nextDue,
      history: [{ date: localToday(), note: 'Migrated from recurring rules' }],
      type: r.type,
      walletId: r.walletId,
      categoryId: r.categoryId,
      createdAt: Date.now(),
    }));
    save([...getSubscriptions(), ...migrated]);
  }

  localStorage.removeItem(userStorageKey(LEGACY_RECURRING_KEY));
  return toAdd.length;
}

export function totalSpentEstimate(sub: Subscription): number {
  const start = new Date(sub.subscribedAt + 'T12:00:00');
  const end = new Date();
  const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
  if (sub.cycle === 'daily') return Math.round(sub.amount * (months * 30.44));
  if (sub.cycle === 'weekly') return Math.round(sub.amount * (months * 4.33));
  if (sub.cycle === 'yearly') return Math.round(sub.amount * Math.max(1, months / 12));
  return Math.round(sub.amount * months);
}

export function subscribedLabel(sub: Subscription): string {
  const start = new Date(sub.subscribedAt + 'T12:00:00');
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) { years -= 1; months += 12; }
  if (years <= 0 && months <= 0) return 'Just started';
  if (years <= 0) return `${months} month${months === 1 ? '' : 's'}`;
  if (months === 0) return `${years} year${years === 1 ? '' : 's'}`;
  return `${years} year${years === 1 ? '' : 's'}, ${months} month${months === 1 ? '' : 's'}`;
}

export const CATEGORY_LABELS: Record<SubCategory, string> = {
  streaming: 'Streaming',
  music: 'Music',
  productivity: 'Productivity',
  cloud: 'Cloud',
  fitness: 'Fitness',
  news: 'News',
  shopping: 'Shopping',
  finance: 'Finance',
  other: 'Other',
};
