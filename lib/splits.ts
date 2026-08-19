import { SplitGroup, SplitEntry, Transaction } from './types';
import { userStorageKey } from './auth';
import { scheduleCloudSync } from './supabase/sync';

const KEY = 'money_buddy_splits';

function storageKey() {
  return userStorageKey(KEY);
}

export function getSplitGroups(): SplitGroup[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey()) ?? '[]');
  } catch {
    return [];
  }
}

function save(groups: SplitGroup[]) {
  localStorage.setItem(storageKey(), JSON.stringify(groups));
  scheduleCloudSync();
}

export function addSplitGroup(name: string, members: string[], openingBalances?: Record<string, number>): SplitGroup {
  const group: SplitGroup = {
    id: crypto.randomUUID(),
    name,
    members,
    openingBalances: openingBalances && Object.keys(openingBalances).length ? openingBalances : undefined,
    entries: [],
    settled: false,
    createdAt: Date.now(),
  };
  save([...getSplitGroups(), group]);
  return group;
}

/** Set a member's opening balance: positive = they owe me, negative = I owe them, 0 clears it. */
export function setOpeningBalance(groupId: string, member: string, amount: number) {
  save(getSplitGroups().map(g => {
    if (g.id !== groupId) return g;
    const ob = { ...(g.openingBalances ?? {}) };
    if (amount === 0) delete ob[member];
    else ob[member] = amount;
    return { ...g, openingBalances: Object.keys(ob).length ? ob : undefined };
  }));
}

export function addSplitEntry(groupId: string, entry: Omit<SplitEntry, 'id' | 'createdAt'>): SplitEntry {
  const full: SplitEntry = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() };
  save(getSplitGroups().map(g =>
    g.id === groupId ? { ...g, entries: [...g.entries, full] } : g
  ));
  return full;
}

export function deleteSplitEntry(groupId: string, entryId: string) {
  save(getSplitGroups().map(g =>
    g.id === groupId ? { ...g, entries: g.entries.filter(e => e.id !== entryId) } : g
  ));
}

export function settleGroup(groupId: string) {
  save(getSplitGroups().map(g =>
    g.id === groupId ? { ...g, settled: true, settledAt: Date.now() } : g
  ));
}

export function updateSplitGroup(groupId: string, patch: Partial<Pick<SplitGroup, 'name' | 'members' | 'pinned'>>) {
  save(getSplitGroups().map(g => g.id === groupId ? { ...g, ...patch } : g));
}

export function deleteSplitGroup(groupId: string) {
  save(getSplitGroups().filter(g => g.id !== groupId));
}

/** Move a member to the former-members list (call only after their balance is zero). */
export function removeMemberToFormer(groupId: string, name: string) {
  save(getSplitGroups().map(g =>
    g.id === groupId
      ? {
          ...g,
          members: g.members.filter(m => m !== name),
          formerMembers: [...(g.formerMembers ?? []).filter(m => m !== name), name],
        }
      : g
  ));
}

/**
 * Whole-rupee equal split — no decimals, ever. The leftover rupee(s) from
 * division go to whoever paid, so ₹100 among 3 becomes 34/33/33 with the
 * payer at 34, instead of 33.33 each.
 */
export function equalShares(totalAmount: number, splitAmong: string[], paidBy: string): Record<string, number> {
  const n = splitAmong.length;
  if (n === 0) return {};
  const total = Math.round(totalAmount);
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  const shares: Record<string, number> = {};
  for (const p of splitAmong) shares[p] = base;
  const target = splitAmong.includes(paidBy) ? paidBy : splitAmong[0];
  shares[target] += remainder;
  return shares;
}

/** A person's ₹ share of an entry — custom amount if set, else equal split. */
export function shareOf(entry: SplitEntry, person: string): number {
  if (!entry.splitAmong.includes(person)) return 0;
  if (entry.shares && entry.shares[person] != null) return entry.shares[person];
  return equalShares(entry.totalAmount, entry.splitAmong, entry.paidBy)[person] ?? 0;
}

// Per-member net: positive = they owe me, negative = I owe them
export function calcBalances(group: SplitGroup): Record<string, number> {
  const bal: Record<string, number> = Object.fromEntries(group.members.map(m => [m, 0]));
  // Seed opening balances (covers former members too, so their settlements still net out)
  for (const [m, amt] of Object.entries(group.openingBalances ?? {})) {
    bal[m] = (bal[m] ?? 0) + amt;
  }
  for (const e of group.entries) {
    if (!e.splitAmong.length) continue;
    if (e.paidBy === 'me') {
      for (const p of e.splitAmong) {
        if (p !== 'me') bal[p] = (bal[p] ?? 0) + shareOf(e, p);
      }
    } else if (e.splitAmong.includes('me')) {
      bal[e.paidBy] = (bal[e.paidBy] ?? 0) - shareOf(e, 'me');
    }
  }
  return bal;
}

// Net across all members: positive = I'm owed overall, negative = I owe overall
export function groupNetTotal(group: SplitGroup): number {
  return Object.values(calcBalances(group)).reduce((a, b) => a + b, 0);
}

/** My true cost in a group: sum of MY shares of every real bill (settlements/forgiveness excluded). */
export function myNetShare(group: SplitGroup): number {
  return group.entries
    .filter(e => !e.isSettlement && e.splitAmong.includes('me'))
    .reduce((sum, e) => sum + shareOf(e, 'me'), 0);
}

/**
 * For stats: in fully-settled groups, replace all linked wallet entries (full bills,
 * repayments, settlement payments) with one net-expense line = my share only.
 * Wallet balances must keep using the raw list — this is for income/expense totals.
 */
export function adjustForSettledSplits(txns: Transaction[]): Transaction[] {
  const settledGroups = getSplitGroups().filter(g => g.settled);
  if (!settledGroups.length) return txns;

  const excluded = new Set<string>();
  const virtual: Transaction[] = [];
  for (const g of settledGroups) {
    for (const e of g.entries) {
      if (e.linkedTransactionId) excluded.add(e.linkedTransactionId);
    }
    const net = myNetShare(g);
    if (net > 0) {
      const when = g.settledAt ?? g.createdAt;
      virtual.push({
        id: `splitnet_${g.id}`,
        type: 'expense',
        amount: Math.round(net),
        description: `✂️ ${g.name} (my share)`,
        paymentMode: 'cash',
        date: new Date(when).toISOString().slice(0, 10),
        createdAt: when,
      });
    }
  }
  return [...txns.filter(t => !excluded.has(t.id)), ...virtual];
}
