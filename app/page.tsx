'use client';
import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { Transaction, Category, WalletTransfer, SplitGroup } from '@/lib/types';
import { getTransactions, addTransaction, addTransactions, updateTransaction, deleteTransaction, migrateTransactionsToWallets } from '@/lib/storage';
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
import { isVoiceConfigured } from '@/lib/voice/client';
import { isSupabaseEnabled } from '@/lib/supabase/client';
import { isRecordingSupported } from '@/lib/voice/recorder';
import { VoiceResult } from '@/lib/voice/types';
import { isInMonth } from '@/lib/insights';
import { sumRealExpense, sumRealIncome } from '@/lib/transfers';
import Onboarding from '@/components/Onboarding';
import AuthScreen from '@/components/AuthScreen';
import ProfileHeader from '@/components/ProfileHeader';
import SettingsPanel from '@/components/SettingsPanel';
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
import VoiceButton from '@/components/VoiceButton';
import VoiceConfirmSheet from '@/components/VoiceConfirmSheet';
import BottomDock, { AppTab } from '@/components/BottomDock';
import SiriHoldTop from '@/components/SiriHoldTop';
import HomeDashboard from '@/components/HomeDashboard';

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showForm, setShowForm] = useState(false);
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
  const [voiceAutoStart, setVoiceAutoStart] = useState(false);
  const [voiceResult, setVoiceResult] = useState<{ id: number; data: VoiceResult } | null>(null);
  const voiceSeq = useRef(0);
  // Mic support is a browser-only fact; the server snapshot must stay false
  const canRecord = useSyncExternalStore(() => () => {}, isRecordingSupported, () => false);
  const voiceEnabled = !!authenticated && isSupabaseEnabled() && canRecord;
  const [tab, setTab] = useState<AppTab>('home');
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [showBudget, setShowBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');

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

  const monthTransactions = useMemo(
    () => statsTransactions.filter(t => isInMonth(t.date, monthCursor.getFullYear(), monthCursor.getMonth())),
    [statsTransactions, monthCursor],
  );
  const monthTransfers = useMemo(
    () => transfers.filter(t => isInMonth(t.date, monthCursor.getFullYear(), monthCursor.getMonth())),
    [transfers, monthCursor],
  );
  const monthExpense = useMemo(() => sumRealExpense(monthTransactions, monthTransfers), [monthTransactions, monthTransfers]);
  const monthIncome = useMemo(() => sumRealIncome(monthTransactions, monthTransfers), [monthTransactions, monthTransfers]);
  const activeCategory = categoryFilter && categoryFilter !== '__none'
    ? categories.find(c => c.id === categoryFilter)
    : null;

  function saveBudget() {
    const val = Number(budgetDraft);
    setBudget(val > 0 ? val : 0);
    if (val > 0) localStorage.setItem(userStorageKey('money_buddy_budget'), String(val));
    else localStorage.removeItem(userStorageKey('money_buddy_budget'));
    scheduleCloudSync();
    setShowBudget(false);
  }

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
    } else {
      const action = new URLSearchParams(window.location.search).get('action');
      if (action === 'add') {
        setShowForm(true);
        window.history.replaceState({}, '', '/');
      } else if (action === 'voice') {
        setVoiceAutoStart(true);
        window.history.replaceState({}, '', '/');
      }
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

  // Warm the voice config cache so the first press already knows if the key is live
  useEffect(() => {
    if (voiceEnabled) void isVoiceConfigured();
  }, [voiceEnabled]);

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

  const handleVoiceResult = useCallback((data: VoiceResult) => {
    voiceSeq.current += 1;
    setVoiceResult({ id: voiceSeq.current, data });
  }, []);

  const handleVoiceSave = useCallback((txns: Transaction[]) => {
    addTransactions(txns);
    refresh();
    setVoiceResult(null);
  }, [refresh]);

  const handleFullReset = useCallback(() => {
    setTransactions([]);
    setTransfers([]);
    setBudget(0);
    setStreak(0);
    setPreviousStreak(0);
    setRecurringAdded(0);
    setSearch('');
    setWalletFilter(null);
    setViewMode('all');
    setShowForm(false);
    setVoiceResult(null);
    reloadSplits();
    reloadCategories();
    reloadTransfers();
    refresh();
  }, [refresh, reloadSplits, reloadCategories, reloadTransfers]);

  if (authenticated === null) {
    return <main className="min-h-dvh bg-[var(--app-bg)]" />;
  }

  if (!authenticated) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  const moreProps = {
    transactions,
    viewTransactions,
    transfers,
    categories,
    viewMode,
    walletFilter,
    onWalletFilter: (id: string) => setWalletFilter(prev => prev === id ? null : id),
    budget,
    onSetBudget: setBudget,
    onRefresh: refresh,
    recurringRefresh,
    onTransfer: () => { reloadTransfers(); reloadCategories(); refresh(); },
    onTransferUndo: () => { reloadTransfers(); refresh(); },
  };

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[var(--app-bg)]">
      <div
        className="max-w-md w-full mx-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] flex flex-col gap-4 min-w-0 overflow-x-hidden"
        style={{ paddingBottom: 'max(8.5rem, calc(env(safe-area-inset-bottom) + 6.5rem))' }}
      >
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
          <div className="clay clay-amber animate-pop-in flex items-center justify-between px-4 py-3 gap-2 min-w-0 overflow-hidden">
            <span className="font-black text-amber-900 text-sm min-w-0 flex-1 leading-snug">
              🔄 {recurringAdded} recurring {recurringAdded === 1 ? 'entry' : 'entries'} auto-added!
            </span>
            <button type="button" onClick={() => setRecurringAdded(0)}
              className="clay-btn text-amber-700 font-black text-xs px-2 py-1 rounded-[8px] bg-amber-100">
              ✕
            </button>
          </div>
        )}

        {tab === 'home' && (
          <>
            <HomeDashboard
              expense={monthExpense}
              income={monthIncome}
              budget={budget}
              month={monthCursor}
              onMonthChange={delta => setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() + delta, 1))}
              onSetBudget={() => { setBudgetDraft(budget > 0 ? String(budget) : ''); setShowBudget(true); }}
              activeCategory={activeCategory}
              incomeNotSet={monthIncome === 0}
            />

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
                  </div>
                  <span className={`text-xs font-black shrink-0 ml-2 ${net === 0 ? 'text-stone-400' : net > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {net === 0 ? 'All even' : net > 0 ? `+₹${Math.abs(net).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `-₹${Math.abs(net).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                  </span>
                </button>
              );
            })}

            {showBudget && (
              <div className="clay animate-pop-in grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 p-3 items-center min-w-0">
                <span className="text-stone-500 font-black text-sm">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={budgetDraft}
                  onChange={e => setBudgetDraft(e.target.value.replace(/[^\d.]/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && saveBudget()}
                  placeholder="Monthly limit (0 to clear)"
                  className="clay w-full min-w-0 px-3 py-2.5 bg-transparent outline-none font-bold text-stone-700 placeholder:text-stone-400"
                />
                <button type="button" onClick={saveBudget}
                  className="clay-btn bg-violet-500 text-white font-black text-xs px-3 py-1.5 rounded-[10px] shrink-0">
                  Save
                </button>
              </div>
            )}

            <div className="sheet-card -mx-4 mt-1 min-h-[46vh] px-4 pb-4 pt-2">
              <SiriHoldTop />
              <div className="flex flex-col gap-3 pt-2">
                <EntrySearch value={search} onChange={v => setSearch(v)} />
                {categories.length > 0 && (
                  <ViewModeBar categories={categories} viewMode={viewMode} onSelect={setViewMode} />
                )}
                {splitEnabled && (
                  <button
                    type="button"
                    onClick={() => { setSplitGroupId(undefined); setShowSplitTab(true); }}
                    className="clay-btn clay w-full py-3 font-bold text-stone-600 text-center text-sm min-h-[44px]">
                    ✂️ Split Groups
                  </button>
                )}
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
                <LowBalanceAlert transactions={transactions} />
                <CreditCardReminders transactions={transactions} />
              </div>
            </div>
          </>
        )}

        {tab === 'insights' && (
          <div className="flex flex-col gap-4">
            <h1 className="text-[28px] font-black text-white">Insights</h1>
            {transactions.length === 0 ? (
              <p className="rounded-[16px] border border-white/10 px-4 py-3 text-center text-sm font-semibold text-zinc-400">
                Add transactions to get AI insights
              </p>
            ) : (
              <MoreSection {...moreProps} pane="insights" />
            )}
          </div>
        )}

        {tab === 'tools' && <MoreSection {...moreProps} pane="tools" />}

        {tab === 'settings' && (
          <div className="flex flex-col gap-4">
            <ProfileHeader
              streak={streak}
              onLogout={handleLogout}
              onOpenSettings={() => {}}
            />
            <SettingsPanel
              embedded
              onClose={() => { setTab('home'); reloadSplits(); }}
              onChange={() => { reloadCategories(); reloadTransfers(); refresh(); reloadSplits(); }}
              onReset={handleFullReset}
            />
          </div>
        )}
      </div>

      <BottomDock tab={tab} onTab={setTab} onAdd={() => setShowForm(true)} />

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

      {voiceResult && (
        <VoiceConfirmSheet
          key={voiceResult.id}
          result={voiceResult.data}
          onSaveAll={handleVoiceSave}
          onClose={() => setVoiceResult(null)}
        />
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

      {/* Sticky hold-to-talk — sits just above the dock */}
      {voiceEnabled && !showForm && tab !== 'settings' && !showSplitTab && !voiceResult && !showOnboarding && !showStreakPopup && (
        <div
          className="fixed inset-x-0 z-30 flex justify-center px-4 pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.25rem)' }}>
          <div className="w-full max-w-md pointer-events-auto">
            <VoiceButton
              variant="bar"
              autoStart={voiceAutoStart}
              onResult={handleVoiceResult}
            />
          </div>
        </div>
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
