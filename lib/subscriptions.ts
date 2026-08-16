import { userStorageKey } from './auth';
import { scheduleCloudSync } from './supabase/sync';

export type SubCycle = 'weekly' | 'monthly' | 'yearly';
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

export function nextPaymentFrom(first: string, cycle: SubCycle, from = localToday()): string {
  let next = first;
  let guard = 0;
  while (next < from && guard < 600) {
    if (cycle === 'weekly') next = addDays(next, 7);
    else if (cycle === 'yearly') next = addDays(next, 365);
    else {
      const d = new Date(next + 'T12:00:00');
      d.setMonth(d.getMonth() + 1);
      next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    guard += 1;
  }
  return next;
}

export function yearlyCost(sub: Subscription): number {
  if (sub.cancelled) return 0;
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

export function totalSpentEstimate(sub: Subscription): number {
  const start = new Date(sub.subscribedAt + 'T12:00:00');
  const end = new Date();
  const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
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
