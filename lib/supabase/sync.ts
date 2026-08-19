import { Transaction, Wallet, Category, SpendCategory, WalletTransfer, RecurringRule, SavingsGoal, SplitGroup } from '../types';
import type { Subscription } from '../subscriptions';
import { getSupabase } from './client';

function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('money_buddy_session');
    if (!raw) return null;
    return JSON.parse(raw).userId ?? null;
  } catch {
    return null;
  }
}

const DEFAULT_WALLETS: Wallet[] = [
  { id: 'gpay_hdfc', name: 'HDFC Bank', emoji: '📱' },
  { id: 'gpay_yes', name: 'Yes Bank', emoji: '📱' },
  { id: 'cash', name: 'Cash', emoji: '💵' },
];

function userKey(base: string, userId: string) {
  return `${base}_${userId}`;
}

function writeLocal(userId: string, data: {
  transactions: Transaction[];
  wallets: Wallet[];
  categories: Category[];
  spendCategories: SpendCategory[];
  transfers: WalletTransfer[];
  recurring: RecurringRule[];
  subscriptions: Subscription[];
  splits: SplitGroup[];
  goal: SavingsGoal | null;
  budget: number;
  onboardingDone: boolean;
}) {
  localStorage.setItem(userKey('money_buddy_txns', userId), JSON.stringify(data.transactions));
  localStorage.setItem(userKey('money_buddy_wallets', userId), JSON.stringify(data.wallets.length ? data.wallets : DEFAULT_WALLETS));
  localStorage.setItem(userKey('money_buddy_categories', userId), JSON.stringify(data.categories));
  localStorage.setItem(userKey('money_buddy_spend_categories', userId), JSON.stringify(data.spendCategories));
  localStorage.setItem(userKey('money_buddy_transfers', userId), JSON.stringify(data.transfers));
  localStorage.setItem(userKey('money_buddy_recurring', userId), JSON.stringify(data.recurring));
  localStorage.setItem(userKey('money_buddy_subscriptions', userId), JSON.stringify(data.subscriptions));
  localStorage.setItem(userKey('money_buddy_splits', userId), JSON.stringify(data.splits));
  if (data.goal) {
    localStorage.setItem(userKey('money_buddy_savings_goal', userId), JSON.stringify(data.goal));
  } else {
    localStorage.removeItem(userKey('money_buddy_savings_goal', userId));
  }
  if (data.budget > 0) {
    localStorage.setItem(userKey('money_buddy_budget', userId), String(data.budget));
  } else {
    localStorage.removeItem(userKey('money_buddy_budget', userId));
  }
  if (data.onboardingDone) {
    localStorage.setItem(userKey('onboarding_done', userId), '1');
  } else {
    localStorage.removeItem(userKey('onboarding_done', userId));
  }
}

function readLocal(userId: string) {
  const parse = <T>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(userKey(key, userId));
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    transactions: parse<Transaction[]>('money_buddy_txns', []),
    wallets: parse<Wallet[]>('money_buddy_wallets', DEFAULT_WALLETS),
    categories: parse<Category[]>('money_buddy_categories', []),
    spendCategories: parse<SpendCategory[]>('money_buddy_spend_categories', []),
    transfers: parse<WalletTransfer[]>('money_buddy_transfers', []),
    recurring: parse<RecurringRule[]>('money_buddy_recurring', []),
    subscriptions: parse<Subscription[]>('money_buddy_subscriptions', []),
    splits: parse<SplitGroup[]>('money_buddy_splits', []),
    goal: parse<SavingsGoal | null>('money_buddy_savings_goal', null),
    budget: Number(localStorage.getItem(userKey('money_buddy_budget', userId)) || 0),
    onboardingDone: localStorage.getItem(userKey('onboarding_done', userId)) === '1',
  };
}

function hasMeaningfulData(data: {
  transactions: Transaction[];
  categories: Category[];
  transfers: WalletTransfer[];
  recurring: RecurringRule[];
  subscriptions: Subscription[];
  splits: SplitGroup[];
  goal: SavingsGoal | null;
}): boolean {
  return (
    data.transactions.length > 0 ||
    data.categories.length > 0 ||
    data.transfers.length > 0 ||
    data.recurring.length > 0 ||
    data.subscriptions.length > 0 ||
    data.splits.length > 0 ||
    data.goal != null
  );
}

/** Download cloud data into localStorage (source of truth on login). */
export async function pullFromCloud(): Promise<boolean> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return false;

  const localBeforePull = readLocal(userId);

  const [txRes, walRes, catRes, spendCatRes, trRes, recRes, subRes, splitRes, goalRes, setRes] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', userId),
    supabase.from('wallets').select('*').eq('user_id', userId),
    supabase.from('categories').select('*').eq('user_id', userId),
    supabase.from('spend_categories').select('*').eq('user_id', userId),
    supabase.from('category_transfers').select('*').eq('user_id', userId),
    supabase.from('recurring_rules').select('*').eq('user_id', userId),
    supabase.from('subscriptions').select('*').eq('user_id', userId),
    supabase.from('split_groups').select('*').eq('user_id', userId),
    supabase.from('savings_goals').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  // Abort the whole pull if any query failed — an error must never look like "no data",
  // otherwise local data would be overwritten with an empty list
  const queryError = txRes.error || walRes.error || catRes.error || trRes.error
    || recRes.error || goalRes.error || setRes.error;
  if (queryError) throw queryError;

  const transactions: Transaction[] = (txRes.data ?? []).map(r => ({
    id: r.id,
    type: r.type,
    amount: r.amount,
    description: r.description ?? '',
    paymentMode: r.payment_mode ?? 'gpay',
    bank: r.bank ?? undefined,
    walletId: r.wallet_id ?? undefined,
    categoryId: r.category_id ?? undefined,
    spendCategoryId: r.spend_category_id ?? undefined,
    recurringRuleId: r.recurring_rule_id ?? undefined,
    subscriptionId: r.subscription_id ?? undefined,
    date: r.date,
    createdAt: r.created_at,
  }));

  const wallets: Wallet[] = (walRes.data ?? []).map(r => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    openingBalance: r.opening_balance != null ? Number(r.opening_balance) : undefined,
    minBalance: r.min_balance != null ? Number(r.min_balance) : undefined,
    isCreditCard: r.is_credit_card ?? undefined,
    creditLimit: r.credit_limit != null ? Number(r.credit_limit) : undefined,
    statementDay: r.statement_day ?? undefined,
    dueDay: r.due_day ?? undefined,
  }));

  const categories: Category[] = (catRes.data ?? []).map(r => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    budget: r.budget ?? 0,
    walletId: r.wallet_id ?? undefined,
  }));

  // The spend_categories table may not exist yet (migration not run) — keep whatever
  // is on the device in that case instead of treating the failure as "no categories".
  const spendCategories: SpendCategory[] = spendCatRes.error
    ? localBeforePull.spendCategories
    : (spendCatRes.data ?? []).map(r => ({
        id: r.id,
        name: r.name,
        emoji: r.emoji,
        budget: r.budget ?? 0,
      }));

  const transfers: WalletTransfer[] = (trRes.data ?? []).map(r => ({
    id: r.id,
    amount: r.amount,
    fromWalletId: r.from_wallet_id ?? '',
    toWalletId: r.to_wallet_id ?? '',
    fromCategoryId: r.from_category_id ?? undefined,
    toCategoryId: r.to_category_id ?? undefined,
    note: r.note ?? undefined,
    date: r.date,
    createdAt: r.created_at,
    expenseTxnId: r.expense_txn_id ?? undefined,
    incomeTxnId: r.income_txn_id ?? undefined,
  }));

  const recurring: RecurringRule[] = (recRes.data ?? []).map(r => ({
    id: r.id,
    type: r.type,
    amount: r.amount,
    description: r.description ?? '',
    walletId: r.wallet_id,
    categoryId: r.category_id ?? undefined,
    frequency: r.frequency,
    nextDue: r.next_due,
    linkedTransactionId: r.linked_transaction_id ?? undefined,
  }));

  // Subscriptions table may not exist yet (migration not run) — keep local in that case
  const subscriptions: Subscription[] = subRes.error
    ? localBeforePull.subscriptions
    : (subRes.data ?? []).map(r => ({
        id: r.id,
        name: r.name,
        amount: r.amount,
        currency: r.currency ?? 'INR',
        cycle: r.cycle,
        list: r.list,
        category: r.category,
        firstPayment: r.first_payment,
        nextPayment: r.next_payment,
        duration: r.duration ?? 'forever',
        freeTrial: r.free_trial ?? false,
        notifyDaysBefore: r.notify_days_before ?? 1,
        emoji: r.emoji,
        color: r.color,
        cancelled: r.cancelled ?? false,
        subscribedAt: r.subscribed_at,
        history: r.history ?? [],
        type: r.type ?? undefined,
        walletId: r.wallet_id ?? undefined,
        categoryId: r.category_id ?? undefined,
        createdAt: r.created_at,
      }));

  // Keep local splits when the split_groups table is missing (SQL not run) OR when it
  // exists but is empty while local has groups (freshly-created table must not wipe them)
  const keepLocalSplits =
    splitRes.error || ((splitRes.data ?? []).length === 0 && localBeforePull.splits.length > 0);
  const splits: SplitGroup[] = keepLocalSplits
    ? localBeforePull.splits
    : (splitRes.data ?? []).map(r => ({
        id: r.id,
        name: r.name,
        members: r.members ?? [],
        formerMembers: r.former_members ?? undefined,
        openingBalances: r.opening_balances ?? undefined,
        entries: r.entries ?? [],
        settled: r.settled ?? false,
        settledAt: r.settled_at ?? undefined,
        createdAt: r.created_at,
        pinned: r.pinned ?? undefined,
      }));

  const goal = goalRes.data
    ? { target: goalRes.data.target, label: goalRes.data.label }
    : null;

  // Never let an empty cloud collection erase local data (freshly created table,
  // or a sync that failed before ever uploading) — keep local and re-upload instead.
  // Data only leaves a collection when the cloud still has other rows in it,
  // i.e. a genuine single-item deletion made on another device.
  let keptLocal = keepLocalSplits && splits.length > 0;
  const keepIfCloudEmpty = <T>(cloud: T[], local: T[]): T[] => {
    if (cloud.length === 0 && local.length > 0) {
      keptLocal = true;
      return local;
    }
    return cloud;
  };

  const cloudData = {
    transactions: keepIfCloudEmpty(transactions, localBeforePull.transactions),
    wallets: keepIfCloudEmpty(wallets, localBeforePull.wallets),
    categories: keepIfCloudEmpty(categories, localBeforePull.categories),
    spendCategories: keepIfCloudEmpty(spendCategories, localBeforePull.spendCategories),
    transfers: keepIfCloudEmpty(transfers, localBeforePull.transfers),
    recurring: keepIfCloudEmpty(recurring, localBeforePull.recurring),
    subscriptions: subRes.error ? subscriptions : keepIfCloudEmpty(subscriptions, localBeforePull.subscriptions),
    splits,
    goal: goal ?? localBeforePull.goal,
    budget: setRes.data?.monthly_budget ?? localBeforePull.budget,
    onboardingDone: (setRes.data?.onboarding_done ?? false) || localBeforePull.onboardingDone,
  };

  const cloudEmpty = !hasMeaningfulData({ transactions, categories, transfers, recurring, subscriptions, splits, goal });
  const localHasData = hasMeaningfulData(localBeforePull);

  // Never wipe local entries when Supabase is empty (failed sync, grace period, new account).
  if (cloudEmpty && localHasData) {
    console.warn('Cloud empty but local has data — keeping local and uploading');
    await pushToCloud();
    return true;
  }

  writeLocal(userId, cloudData);

  // Some cloud collections were missing/empty — upload the local data we kept
  if (keptLocal) {
    scheduleCloudSync();
  }

  if (setRes.data?.streak_count != null || setRes.data?.last_visit_date) {
    const { mergeStreakFromCloud } = await import('../streak');
    mergeStreakFromCloud({
      streak: setRes.data?.streak_count ?? 0,
      lastVisitDate: setRes.data?.last_visit_date ?? '',
    });
  }
  if (setRes.data?.wallet_order) {
    try {
      localStorage.setItem(userKey('money_buddy_wallet_order', userId), setRes.data.wallet_order);
    } catch { /* ignore */ }
  }
  if (setRes.data?.notifications_enabled) {
    localStorage.setItem(userKey('money_buddy_notifications', userId), '1');
  }
  if (setRes.data?.credit_cards_enabled != null) {
    localStorage.setItem('money_buddy_credit_cards_enabled', setRes.data.credit_cards_enabled ? 'true' : 'false');
  }
  if (setRes.data?.split_enabled != null) {
    localStorage.setItem('money_buddy_split_enabled', setRes.data.split_enabled ? 'true' : 'false');
  }
  if (Array.isArray(setRes.data?.cc_reminders_dismissed) && setRes.data.cc_reminders_dismissed.length) {
    localStorage.setItem(userKey('money_buddy_cc_reminders_dismissed', userId), JSON.stringify(setRes.data.cc_reminders_dismissed));
  }
  if (Array.isArray(setRes.data?.cc_reminders_notified) && setRes.data.cc_reminders_notified.length) {
    localStorage.setItem(userKey('money_buddy_cc_reminders_notified', userId), JSON.stringify(setRes.data.cc_reminders_notified));
  }

  return true;
}

/** Upload local data to cloud (upsert + prune — never delete-first). */
export async function pushToCloud(): Promise<boolean> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return false;

  const local = readLocal(userId);

  if (local.transactions.length) {
    const rows = local.transactions.map(t => ({
      id: t.id,
      user_id: userId,
      type: t.type,
      amount: t.amount,
      description: t.description,
      payment_mode: t.paymentMode,
      bank: t.bank ?? null,
      wallet_id: t.walletId ?? null,
      category_id: t.categoryId ?? null,
      recurring_rule_id: t.recurringRuleId ?? null,
      date: t.date,
      created_at: t.createdAt,
    }));

    let { error } = await supabase.from('transactions').upsert(
      rows.map((row, i) => ({
        ...row,
        spend_category_id: local.transactions[i].spendCategoryId ?? null,
        subscription_id: local.transactions[i].subscriptionId ?? null,
      })),
      { onConflict: 'user_id,id' },
    );
    if (error) {
      // spend_category_id / subscription_id may not exist yet (migration not run) —
      // never let one new column stop every entry from syncing
      console.error('transaction sync with new columns failed, retrying without them', error);
      ({ error } = await supabase.from('transactions').upsert(rows, { onConflict: 'user_id,id' }));
    }
    if (error) throw error;
  }
  {
    const keep = new Set(local.transactions.map(t => t.id));
    const { data, error } = await supabase.from('transactions').select('id').eq('user_id', userId);
    if (error) throw error;
    const remove = (data ?? []).map(r => r.id).filter(id => !keep.has(id));
    if (remove.length) {
      const { error: delErr } = await supabase.from('transactions').delete().eq('user_id', userId).in('id', remove);
      if (delErr) throw delErr;
    }
  }

  if (local.wallets.length) {
    const { error } = await supabase.from('wallets').upsert(
      local.wallets.map(w => ({
        id: w.id,
        user_id: userId,
        name: w.name,
        emoji: w.emoji,
        opening_balance: w.openingBalance ?? null,
        min_balance: w.minBalance ?? null,
        is_credit_card: w.isCreditCard ?? false,
        credit_limit: w.creditLimit ?? null,
        statement_day: w.statementDay ?? null,
        due_day: w.dueDay ?? null,
      })),
      { onConflict: 'user_id,id' },
    );
    if (error) throw error;
  }
  {
    const keep = new Set(local.wallets.map(w => w.id));
    const { data, error } = await supabase.from('wallets').select('id').eq('user_id', userId);
    if (error) throw error;
    const remove = (data ?? []).map(r => r.id).filter(id => !keep.has(id));
    if (remove.length) {
      const { error: delErr } = await supabase.from('wallets').delete().eq('user_id', userId).in('id', remove);
      if (delErr) throw delErr;
    }
  }

  if (local.categories.length) {
    const { error } = await supabase.from('categories').upsert(
      local.categories.map(c => ({
        id: c.id,
        user_id: userId,
        name: c.name,
        emoji: c.emoji,
        budget: c.budget,
        wallet_id: c.walletId ?? null,
      })),
      { onConflict: 'user_id,id' },
    );
    if (error) throw error;
  }
  {
    const keep = new Set(local.categories.map(c => c.id));
    const { data, error } = await supabase.from('categories').select('id').eq('user_id', userId);
    if (error) throw error;
    const remove = (data ?? []).map(r => r.id).filter(id => !keep.has(id));
    if (remove.length) {
      const { error: delErr } = await supabase.from('categories').delete().eq('user_id', userId).in('id', remove);
      if (delErr) throw delErr;
    }
  }

  // Spending categories — tolerate a missing table so everything else still syncs
  try {
    if (local.spendCategories.length) {
      const { error } = await supabase.from('spend_categories').upsert(
        local.spendCategories.map(c => ({
          id: c.id,
          user_id: userId,
          name: c.name,
          emoji: c.emoji,
          budget: c.budget ?? 0,
        })),
        { onConflict: 'user_id,id' },
      );
      if (error) throw error;
    }
    const keep = new Set(local.spendCategories.map(c => c.id));
    const { data, error } = await supabase.from('spend_categories').select('id').eq('user_id', userId);
    if (error) throw error;
    const remove = (data ?? []).map(r => r.id).filter(id => !keep.has(id));
    if (remove.length) {
      const { error: delErr } = await supabase.from('spend_categories').delete().eq('user_id', userId).in('id', remove);
      if (delErr) throw delErr;
    }
  } catch (err) {
    console.error('spend_categories sync failed (run the SQL migration?)', err);
  }

  if (local.transfers.length) {
    const { error } = await supabase.from('category_transfers').upsert(
      local.transfers.map(t => ({
        id: t.id,
        user_id: userId,
        amount: t.amount,
        from_category_id: t.fromCategoryId ?? null,
        to_category_id: t.toCategoryId ?? null,
        from_wallet_id: t.fromWalletId,
        to_wallet_id: t.toWalletId,
        note: t.note ?? null,
        date: t.date,
        created_at: t.createdAt,
        expense_txn_id: t.expenseTxnId ?? null,
        income_txn_id: t.incomeTxnId ?? null,
      })),
      { onConflict: 'user_id,id' },
    );
    if (error) throw error;
  }
  {
    const keep = new Set(local.transfers.map(t => t.id));
    const { data, error } = await supabase.from('category_transfers').select('id').eq('user_id', userId);
    if (error) throw error;
    const remove = (data ?? []).map(r => r.id).filter(id => !keep.has(id));
    if (remove.length) {
      const { error: delErr } = await supabase.from('category_transfers').delete().eq('user_id', userId).in('id', remove);
      if (delErr) throw delErr;
    }
  }

  if (local.recurring.length) {
    const { error } = await supabase.from('recurring_rules').upsert(
      local.recurring.map(r => ({
        id: r.id,
        user_id: userId,
        type: r.type,
        amount: r.amount,
        description: r.description,
        wallet_id: r.walletId,
        category_id: r.categoryId ?? null,
        frequency: r.frequency,
        next_due: r.nextDue,
        linked_transaction_id: r.linkedTransactionId ?? null,
      })),
      { onConflict: 'user_id,id' },
    );
    if (error) throw error;
  }
  {
    const keep = new Set(local.recurring.map(r => r.id));
    const { data, error } = await supabase.from('recurring_rules').select('id').eq('user_id', userId);
    if (error) throw error;
    const remove = (data ?? []).map(r => r.id).filter(id => !keep.has(id));
    if (remove.length) {
      const { error: delErr } = await supabase.from('recurring_rules').delete().eq('user_id', userId).in('id', remove);
      if (delErr) throw delErr;
    }
  }

  // Subscriptions — tolerate a missing table so sync of everything else still works
  try {
    if (local.subscriptions.length) {
      const { error } = await supabase.from('subscriptions').upsert(
        local.subscriptions.map(s => ({
          id: s.id,
          user_id: userId,
          name: s.name,
          amount: s.amount,
          currency: s.currency,
          cycle: s.cycle,
          list: s.list,
          category: s.category,
          first_payment: s.firstPayment,
          next_payment: s.nextPayment,
          duration: s.duration,
          free_trial: s.freeTrial,
          notify_days_before: s.notifyDaysBefore,
          emoji: s.emoji,
          color: s.color,
          cancelled: s.cancelled,
          subscribed_at: s.subscribedAt,
          history: s.history,
          type: s.type ?? null,
          wallet_id: s.walletId ?? null,
          category_id: s.categoryId ?? null,
          created_at: s.createdAt,
        })),
        { onConflict: 'user_id,id' },
      );
      if (error) throw error;
    }
    const keep = new Set(local.subscriptions.map(s => s.id));
    const { data, error } = await supabase.from('subscriptions').select('id').eq('user_id', userId);
    if (error) throw error;
    const remove = (data ?? []).map(r => r.id).filter(id => !keep.has(id));
    if (remove.length) {
      const { error: delErr } = await supabase.from('subscriptions').delete().eq('user_id', userId).in('id', remove);
      if (delErr) throw delErr;
    }
  } catch (err) {
    console.error('subscriptions sync failed (run the SQL migration?)', err);
  }

  // Split groups — tolerate a missing table so sync of everything else still works
  try {
    if (local.splits.length) {
      const { error } = await supabase.from('split_groups').upsert(
        local.splits.map(g => ({
          id: g.id,
          user_id: userId,
          name: g.name,
          members: g.members,
          former_members: g.formerMembers ?? [],
          opening_balances: g.openingBalances ?? {},
          entries: g.entries,
          settled: g.settled,
          settled_at: g.settledAt ?? null,
          created_at: g.createdAt,
          pinned: g.pinned ?? false,
        })),
        { onConflict: 'user_id,id' },
      );
      if (error) throw error;
    }
    const keep = new Set(local.splits.map(g => g.id));
    const { data, error } = await supabase.from('split_groups').select('id').eq('user_id', userId);
    if (error) throw error;
    const remove = (data ?? []).map(r => r.id).filter(id => !keep.has(id));
    if (remove.length) {
      const { error: delErr } = await supabase.from('split_groups').delete().eq('user_id', userId).in('id', remove);
      if (delErr) throw delErr;
    }
  } catch (err) {
    console.error('split_groups sync failed (run the SQL migration?)', err);
  }

  if (local.goal) {
    const { error } = await supabase.from('savings_goals').upsert({
      user_id: userId,
      target: local.goal.target,
      label: local.goal.label,
    });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('savings_goals').delete().eq('user_id', userId);
    if (error) throw error;
  }

  const readJsonArray = (base: string): string[] => {
    try {
      return JSON.parse(localStorage.getItem(userKey(base, userId)) ?? '[]');
    } catch { return []; }
  };

  const baseSettings = {
    user_id: userId,
    monthly_budget: local.budget,
    onboarding_done: local.onboardingDone,
    streak_count: (() => {
      try {
        const raw = localStorage.getItem(userKey('money_buddy_streak', userId));
        return raw ? (JSON.parse(raw).streak ?? 0) : 0;
      } catch { return 0; }
    })(),
    last_visit_date: (() => {
      try {
        const raw = localStorage.getItem(userKey('money_buddy_streak', userId));
        return raw ? (JSON.parse(raw).lastVisitDate ?? null) : null;
      } catch { return null; }
    })(),
    wallet_order: localStorage.getItem(userKey('money_buddy_wallet_order', userId)) ?? null,
    notifications_enabled: localStorage.getItem(userKey('money_buddy_notifications', userId)) === '1',
    credit_cards_enabled: localStorage.getItem('money_buddy_credit_cards_enabled') === 'true',
    split_enabled: localStorage.getItem('money_buddy_split_enabled') === 'true',
  };

  let { error: setErr } = await supabase.from('user_settings').upsert({
    ...baseSettings,
    cc_reminders_dismissed: readJsonArray('money_buddy_cc_reminders_dismissed'),
    cc_reminders_notified: readJsonArray('money_buddy_cc_reminders_notified'),
  });
  if (setErr) {
    // Reminder columns may not exist yet (migration not run) — retry without them
    ({ error: setErr } = await supabase.from('user_settings').upsert(baseSettings));
  }
  if (setErr) throw setErr;

  return true;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced cloud upload after local changes. */
export function scheduleCloudSync() {
  if (!getSupabase() || !getUserId()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    pushToCloud().catch(err => console.error('cloud sync failed', err));
  }, 1500);
}

export async function syncWithCloud(): Promise<void> {
  if (!getSupabase() || !getUserId()) return;
  try {
    await pullFromCloud();
  } catch (err) {
    console.error('pull from cloud failed', err);
    try {
      await pushToCloud();
    } catch (pushErr) {
      console.error('push to cloud failed', pushErr);
    }
  }
}
