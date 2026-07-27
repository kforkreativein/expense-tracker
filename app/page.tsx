'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, Category, WalletTransfer, SplitGroup } from '@/lib/types';
import { getTransactions, addTransaction, updateTransaction, deleteTransaction, migrateTransactionsToWallets } from '@/lib/storage';
import { getSplitGroups, groupNetTotal, adjustForSettledSplits } from '@/lib/splits';
import { getSplitEnabled } from '@/lib/settings';
import { applyDueRecurring } from '@/lib/recurring';
import { userStorageKey, restoreAuth } from '@/lib/auth';
import { scheduleCloudSync } from '@/lib/supabase/sync';
import { getCategories } from '@/lib/categories';
import { getTransfers, migrateTransfersToWallets } from '@/lib/transfers';
import { recordDailyVisit } from '@/lib/streak';
import { filterTransactionsForView, ViewMode } from '@/lib/view';
import { registerServiceWorker, notificationsEnabled, showNotification } from '@/lib/notifications';
import { applyTheme, getTheme } from '@/lib/theme';
import Onboarding from '@/components/Onboarding';
import AuthScreen from '@/components/AuthScreen';
import ProfileHeader from '@/components/ProfileHeader';
import SettingsPanel from '@/components/SettingsPanel';
import StatsBar from '@/components/StatsBar';
import StreakPopup from '@/components/StreakPopup';
import EntrySearch from '@/components/EntrySearch';
import ViewModeBar from '@/components/ViewModeBar';
import TransactionForm from '@/components/TransactionForm';
import TransactionList from '@/components/TransactionList';
import LowBalanceAlert from '@/components/LowBalanceAlert';
import CreditCardReminders from '@/components/CreditCardReminders';
import RecoveryBanner from '@/components/RecoveryBanner';
import MoreSection from '@/components/MoreSection';
import SplitTab from '@/components/SplitTab';

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [streak, setStreak] = useState(0);
  const [previousStreak, setPreviousStreak] = useState(0);
  const [budget, setBudget] = useState(0);
  const [walletFilter, setWalletFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [recurringRefresh, setRecurringRefresh] = useState(0);
  const [recurringAdded, setRecurringAdded] = useState(0);
  const [search, setSearch] = useState('');
  const [showSplitTab, setShowSplitTab] = useState(false);
  const [splitGroupId, setSplitGroupId] = useState<string | undefined>(undefined);
  const [splitGroups, setSplitGroups] = useState<SplitGroup[]>([]);
  const [splitEnabled, setSplitEnabled] = useState(false);

  const refresh = useCallback(() => setTransactions(getTransactions()), []);
  const reloadSplits = useCallback(() => {
    setSplitEnabled(getSplitEnabled());
    setSplitGroups(getSplitGroups());
  }, []);
  const reloadCategories = useCallback(() => setCategories(getCategories()), []);
  const reloadTransfers = useCallback(() => setTransfers(getTransfers()), []);

  const handleRecurringChange = useCallback(() => {
    refresh();
    setRecurringRefresh(n => n + 1);
  }, [refresh]);

  const viewTransactions = useMemo(
    () => filterTransactionsForView(transactions, viewMode),
    [transactions, viewMode],
  );

  // Stats view: settled split groups count as one net "my share" expense
  // (wallet balances & the entry list keep the real money movements)
  const statsTransactions = useMemo(
    () => adjustForSettledSplits(viewTransactions),
    // splitGroups in deps so stats refresh when a group gets settled
    [viewTransactions, splitGroups],
  );

  const categoryFilter = viewMode === 'all' ? null : viewMode;

  const loadAppData = useCallback(() => {
    applyTheme(getTheme());
    registerServiceWorker();
    migrateTransactionsToWallets();
    migrateTransfersToWallets();
    const added = applyDueRecurring();
    if (added > 0) setRecurringAdded(added);
    refresh();
    reloadCategories();
    reloadTransfers();
    reloadSplits();
    setBudget(Number(localStorage.getItem(userStorageKey('money_buddy_budget')) || 0));
    const visit = recordDailyVisit();
    setStreak(visit.streak);
    setPreviousStreak(visit.previousStreak);
    setShowStreakPopup(visit.isFirstVisitToday);
    if (visit.isFirstVisitToday && notificationsEnabled()) {
      showNotification(
        'Money Buddy',
        visit.streak > 1 ? `Day ${visit.streak} streak — welcome back!` : 'Welcome! Start your streak today.',
      );
    }
    if (!localStorage.getItem(userStorageKey('onboarding_done'))) {
      setShowOnboarding(true);
    } else if (new URLSearchParams(window.location.search).get('action') === 'add') {
      setShowForm(true);
      window.history.replaceState({}, '', '/');
    }
  }, [refresh, reloadCategories, reloadTransfers, reloadSplits]);

  useEffect(() => {
    let active = true;
    restoreAuth().then(ok => {
      if (active) setAuthenticated(ok);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authenticated) loadAppData();
  }, [authenticated, loadAppData]);

  const handleAuth = useCallback(() => {
    setAuthenticated(true);
    setShowOnboarding(false);
    setShowForm(false);
    setWalletFilter(null);
    setViewMode('all');
    loadAppData();
  }, [loadAppData]);

  const handleLogout = useCallback(() => {
    applyTheme('light');
    setAuthenticated(false);
    setTransactions([]);
    setTransfers([]);
    setCategories([]);
    setBudget(0);
    setShowOnboarding(false);
    setShowForm(false);
    setShowSettings(false);
    setShowStreakPopup(false);
    setStreak(0);
    setWalletFilter(null);
    setViewMode('all');
    setSearch('');
  }, []);

  const handleSave = useCallback((txn: Transaction) => {
    addTransaction(txn);
    refresh();
    setShowForm(false);
  }, [refresh]);

  const handleUpdate = useCallback((txn: Transaction) => {
    updateTransaction(txn);
    refresh();
  }, [refresh]);

  const handleDelete = useCallback((id: string) => {
    deleteTransaction(id);
    refresh();
  }, [refresh]);

  if (authenticated === null) {
    return <main className="min-h-dvh bg-[var(--app-bg)]" />;
  }

  if (!authenticated) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[var(--app-bg)]">
      <div
        className="max-w-md mx-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] flex flex-col gap-3"
        style={{ paddingBottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 1.5rem))' }}
      >
        <ProfileHeader
          streak={streak}
          onLogout={handleLogout}
          onOpenSettings={() => setShowSettings(true)}
        />

        <RecoveryBanner
          currentCount={transactions.length}
          onRestored={() => {
            const added = applyDueRecurring();
            if (added > 0) setRecurringAdded(added);
            refresh();
            reloadCategories();
            reloadTransfers();
          }}
        />

        {recurringAdded > 0 && (
          <div className="clay clay-amber animate-pop-in flex items-center justify-between px-4 py-3 gap-2">
            <span className="font-black text-amber-900 text-sm">
              🔄 {recurringAdded} recurring {recurringAdded === 1 ? 'entry' : 'entries'} auto-added!
            </span>
            <button type="button" onClick={() => setRecurringAdded(0)}
              className="clay-btn text-amber-700 font-black text-xs px-2 py-1 rounded-[8px] bg-amber-100">
              ✕
            </button>
          </div>
        )}

        {/* 1. Add entry */}
        <button
          onClick={() => setShowForm(true)}
          className="clay-btn clay-purple clay w-full py-4 text-lg font-black text-violet-900 text-center min-h-[52px]">
          ➕ Add Income / Expense / Invest
        </button>

        {/* Split group pinned cards — only pinned ones */}
        {splitEnabled && splitGroups.filter(g => !g.settled && g.pinned).map(g => {
          const net = groupNetTotal(g);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => { setSplitGroupId(g.id); setShowSplitTab(true); }}
              className="clay-btn clay w-full px-4 py-3 flex items-center justify-between min-h-[48px]">
              <div className="flex items-center gap-2 min-w-0">
                <span>✂️</span>
                <span className="font-black text-stone-800 truncate">{g.name}</span>
                <span className="text-xs font-semibold text-stone-400 truncate hidden sm:inline">{g.members.join(', ')}</span>
              </div>
              <span className={`text-xs font-black shrink-0 ml-2 ${net === 0 ? 'text-stone-400' : net > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {net === 0 ? 'All even' : net > 0 ? `+₹${Math.abs(net).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `-₹${Math.abs(net).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              </span>
            </button>
          );
        })}

        {/* Split groups button */}
        {splitEnabled && (
          <button
            type="button"
            onClick={() => { setSplitGroupId(undefined); setShowSplitTab(true); }}
            className="clay-btn clay w-full py-3 font-bold text-stone-600 text-center text-sm min-h-[44px]">
            ✂️ Split Groups
          </button>
        )}

        {/* 2. Monthly stats */}
        <StatsBar
          transactions={statsTransactions}
          budget={budget}
          categories={categories}
          categoryFilter={categoryFilter}
          transfers={transfers}
        />

        {/* 3. Search + category filter */}
        <EntrySearch value={search} onChange={v => setSearch(v)} />

        {categories.length > 0 && (
          <ViewModeBar categories={categories} viewMode={viewMode} onSelect={setViewMode} />
        )}

        {/* 4. Transaction list */}
        <TransactionList
          transactions={viewTransactions}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          walletFilter={walletFilter}
          categoryFilter={categoryFilter}
          onRecurringChange={handleRecurringChange}
          search={search}
          onSearchChange={setSearch}
          hideSearchBar
          onOpenSplitGroup={id => { setSplitGroupId(id); setShowSplitTab(true); }}
        />

        {/* 5. Low balance alert */}
        <LowBalanceAlert transactions={transactions} />

        {/* Credit card statement / due reminders */}
        <CreditCardReminders transactions={transactions} />

        {/* Everything else tucked away */}
        <MoreSection
          transactions={transactions}
          viewTransactions={viewTransactions}
          transfers={transfers}
          categories={categories}
          viewMode={viewMode}
          walletFilter={walletFilter}
          onWalletFilter={id => setWalletFilter(prev => prev === id ? null : id)}
          budget={budget}
          onSetBudget={setBudget}
          onRefresh={refresh}
          recurringRefresh={recurringRefresh}
          onTransfer={() => { reloadTransfers(); reloadCategories(); refresh(); }}
          onTransferUndo={() => { reloadTransfers(); refresh(); }}
        />
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop-in"
          style={{ background: 'var(--overlay-bg)' }}
          onClick={() => setShowForm(false)}>
          <div
            className="w-full max-w-sm max-h-[92dvh] overflow-y-auto rounded-t-[24px] sm:rounded-[24px]"
            onClick={e => e.stopPropagation()}>
            <TransactionForm
              onSave={handleSave}
              onCancel={() => setShowForm(false)}
              onRecurringChange={handleRecurringChange}
            />
          </div>
        </div>
      )}

      {showStreakPopup && (
        <StreakPopup
          previousStreak={previousStreak}
          streak={streak}
          onDone={() => setShowStreakPopup(false)}
        />
      )}

      {showOnboarding && (
        <Onboarding onDone={() => {
          localStorage.setItem(userStorageKey('onboarding_done'), '1');
          scheduleCloudSync();
          setShowOnboarding(false);
        }} />
      )}
      {showSettings && (
        <SettingsPanel
          onClose={() => { setShowSettings(false); reloadSplits(); }}
          onChange={() => { reloadCategories(); reloadTransfers(); refresh(); reloadSplits(); }}
        />
      )}

      {showSplitTab && (
        <SplitTab
          onClose={() => { setShowSplitTab(false); reloadSplits(); }}
          onExpenseAdded={() => { refresh(); reloadSplits(); }}
          initialGroupId={splitGroupId}
        />
      )}
    </main>
  );
}
