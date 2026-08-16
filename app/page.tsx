'use client';
import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { Transaction, Category, WalletTransfer, SplitGroup } from '@/lib/types';
import { getTransactions, addTransaction, addTransactions, updateTransaction, deleteTransaction, migrateTransactionsToWallets } from '@/lib/storage';
import { getSplitGroups, adjustForSettledSplits } from '@/lib/splits';
import { getSplitEnabled, setSplitEnabled } from '@/lib/settings';
import { applyDueRecurring } from '@/lib/recurring';
import { userStorageKey, restoreAuth } from '@/lib/auth';
import { scheduleCloudSync } from '@/lib/supabase/sync';
import { getCategories } from '@/lib/categories';
import { getTransfers, migrateTransfersToWallets } from '@/lib/transfers';
import { recordDailyVisit, markStreakPopupSeen } from '@/lib/streak';
import { filterTransactionsForView, ViewMode } from '@/lib/view';
import { registerServiceWorker, notificationsEnabled, showNotification } from '@/lib/notifications';
import { applyTheme, getTheme } from '@/lib/theme';
import { isVoiceConfigured, importStatementFile, VoiceRequestError } from '@/lib/voice/client';
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
import TransactionForm from '@/components/TransactionForm';
import TransactionList from '@/components/TransactionList';
import RecoveryBanner from '@/components/RecoveryBanner';
import SplitTab from '@/components/SplitTab';
import VoiceButton from '@/components/VoiceButton';
import VoiceConfirmSheet from '@/components/VoiceConfirmSheet';
import BottomDock, { AppTab } from '@/components/BottomDock';
import SiriVoiceOrb from '@/components/SiriVoiceOrb';
import HomeDashboard from '@/components/HomeDashboard';
import AddCaptureMenu from '@/components/AddCaptureMenu';
import InsightsTab from '@/components/InsightsTab';
import FinancialTools from '@/components/FinancialTools';

type TxFilter = 'all' | 'expense' | 'income';

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
  const [splitGroupId, setSplitGroupId] = useState<string | undefined>(undefined);
  const [splitGroups, setSplitGroups] = useState<SplitGroup[]>([]);
  const [splitEnabled, setSplitEnabledState] = useState(false);
  const [voiceAutoStart, setVoiceAutoStart] = useState(false);
  const [showVoiceBar, setShowVoiceBar] = useState(false);
  const [voiceResult, setVoiceResult] = useState<{ id: number; data: VoiceResult } | null>(null);
  const voiceSeq = useRef(0);
  const canRecord = useSyncExternalStore(() => () => {}, isRecordingSupported, () => false);
  const voiceEnabled = !!authenticated && isSupabaseEnabled() && canRecord;
  const [tab, setTab] = useState<AppTab>('home');
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [showBudget, setShowBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [txFilter, setTxFilter] = useState<TxFilter>('all');
  const [importError, setImportError] = useState('');

  const refresh = useCallback(() => setTransactions(getTransactions()), []);
  const reloadSplits = useCallback(() => {
    setSplitEnabledState(getSplitEnabled());
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

  const statsTransactions = useMemo(
    () => adjustForSettledSplits(viewTransactions),
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

  const prevMonth = useMemo(() => new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1), [monthCursor]);
  const prevMonthExpense = useMemo(() => {
    const tx = statsTransactions.filter(t => isInMonth(t.date, prevMonth.getFullYear(), prevMonth.getMonth()));
    const tr = transfers.filter(t => isInMonth(t.date, prevMonth.getFullYear(), prevMonth.getMonth()));
    return sumRealExpense(tx, tr);
  }, [statsTransactions, transfers, prevMonth]);

  const listTransactions = useMemo(() => {
    let list = monthTransactions;
    if (txFilter === 'expense') list = list.filter(t => t.type === 'expense');
    if (txFilter === 'income') list = list.filter(t => t.type === 'income' || t.type === 'investment');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t =>
        t.description.toLowerCase().includes(q) || String(t.amount).includes(q),
      );
    }
    return list;
  }, [monthTransactions, txFilter, search]);

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
        setShowAddMenu(true);
        window.history.replaceState({}, '', '/');
      } else if (action === 'voice') {
        setShowVoiceBar(true);
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

  useEffect(() => {
    if (voiceEnabled) void isVoiceConfigured();
  }, [voiceEnabled]);

  useEffect(() => {
    if (tab === 'split' && !getSplitEnabled()) {
      setSplitEnabled(true);
      setSplitEnabledState(true);
    }
  }, [tab]);

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
    setShowVoiceBar(false);
    setVoiceAutoStart(false);
  }, []);

  const handleVoiceSave = useCallback((txns: Transaction[]) => {
    addTransactions(txns);
    refresh();
    setVoiceResult(null);
  }, [refresh]);

  const handleImportFile = useCallback(async (file: File) => {
    setImportError('');
    setShowAddMenu(false);
    try {
      const data = await importStatementFile(file);
      voiceSeq.current += 1;
      setVoiceResult({ id: voiceSeq.current, data });
    } catch (err) {
      setImportError(err instanceof VoiceRequestError ? err.message : 'Import failed.');
    }
  }, []);

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

  const handleTab = useCallback((next: AppTab) => {
    setTab(next);
    setSheetExpanded(false);
    if (next === 'split') setSplitGroupId(undefined);
  }, []);

  if (authenticated === null) {
    return <main className="min-h-dvh bg-[var(--app-bg)]" />;
  }

  if (!authenticated) {
    return <AuthScreen onAuth={handleAuth} />;
  }

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

        {importError && (
          <div className="rounded-[14px] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 flex justify-between gap-2">
            <span>{importError}</span>
            <button type="button" onClick={() => setImportError('')}>✕</button>
          </div>
        )}

        {tab === 'home' && (
          <>
            {!sheetExpanded && (
              <HomeDashboard
                expense={monthExpense}
                income={monthIncome}
                budget={budget}
                month={monthCursor}
                onMonthSelect={(y, m) => setMonthCursor(new Date(y, m, 1))}
                onSetBudget={() => { setBudgetDraft(budget > 0 ? String(budget) : ''); setShowBudget(true); }}
                expenses={monthTransactions}
                prevMonthExpense={prevMonthExpense}
              />
            )}

            {showBudget && !sheetExpanded && (
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

            <div className={`sheet-card -mx-4 mt-1 min-h-[42vh] px-4 pb-4 pt-2 ${sheetExpanded ? 'is-expanded' : ''}`}>
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  aria-label={sheetExpanded ? 'Collapse transactions' : 'Expand transactions'}
                  onClick={() => setSheetExpanded(v => !v)}
                  className="flex w-full flex-col items-center py-1"
                >
                  <span className="mb-1 h-1 w-10 rounded-full bg-zinc-600" />
                </button>
                {voiceEnabled && (
                  <SiriVoiceOrb
                    active={showVoiceBar}
                    onActivate={() => { setShowVoiceBar(true); setVoiceAutoStart(true); }}
                  />
                )}
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <div className="flex gap-2 rounded-full bg-black/30 p-1">
                  {([
                    { id: 'all' as TxFilter, label: 'ALL' },
                    { id: 'expense' as TxFilter, label: 'EXPENSES' },
                    { id: 'income' as TxFilter, label: 'INCOME' },
                  ]).map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTxFilter(f.id)}
                      className={`flex-1 rounded-full py-2.5 text-[11px] font-black tracking-wide min-h-[40px] ${
                        txFilter === f.id ? 'bg-zinc-200 text-black' : 'text-zinc-400 border border-white/10'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <TransactionList
                  transactions={listTransactions}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  walletFilter={walletFilter}
                  categoryFilter={categoryFilter}
                  onRecurringChange={handleRecurringChange}
                  search={search}
                  onSearchChange={setSearch}
                  hideSearchBar
                  onOpenSplitGroup={id => { setSplitGroupId(id); setTab('split'); }}
                />
              </div>
            </div>
          </>
        )}

        {tab === 'insights' && (
          <InsightsTab
            transactions={viewTransactions}
            monthTransactions={monthTransactions}
            transfers={transfers}
            categories={categories}
            budget={budget}
            income={monthIncome}
            year={monthCursor.getFullYear()}
            month={monthCursor.getMonth()}
            walletFilter={walletFilter}
            onWalletFilter={id => setWalletFilter(prev => prev === id ? null : id)}
            onRefresh={refresh}
          />
        )}

        {tab === 'split' && (
          <SplitTab
            embedded
            onClose={() => setTab('home')}
            onExpenseAdded={() => { refresh(); reloadSplits(); }}
            initialGroupId={splitGroupId}
          />
        )}

        {tab === 'tools' && (
          <FinancialTools
            transactions={transactions}
            budget={budget}
            expense={monthExpense}
            onSetBudget={setBudget}
            onRefresh={refresh}
            walletFilter={walletFilter}
            onWalletFilter={id => setWalletFilter(prev => prev === id ? null : id)}
            recurringRefresh={recurringRefresh}
          />
        )}

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

      <BottomDock tab={tab} onTab={handleTab} onAdd={() => setShowAddMenu(true)} />

      <AddCaptureMenu
        open={showAddMenu}
        onClose={() => setShowAddMenu(false)}
        onManual={() => setShowForm(true)}
        onVoice={() => { setShowVoiceBar(true); setVoiceAutoStart(true); }}
        onImage={handleImportFile}
        onPdf={handleImportFile}
        voiceAvailable={voiceEnabled}
      />

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
          onDone={() => {
            markStreakPopupSeen();
            setShowStreakPopup(false);
          }}
        />
      )}

      {showOnboarding && (
        <Onboarding onDone={() => {
          localStorage.setItem(userStorageKey('onboarding_done'), '1');
          scheduleCloudSync();
          setShowOnboarding(false);
        }} />
      )}

      {voiceEnabled && showVoiceBar && !showForm && !voiceResult && !showOnboarding && !showStreakPopup && (
        <div
          className="fixed inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.25rem)' }}>
          <div className="w-full max-w-md pointer-events-auto">
            <VoiceButton
              variant="bar"
              autoStart={voiceAutoStart}
              onResult={handleVoiceResult}
            />
            <button
              type="button"
              onClick={() => { setShowVoiceBar(false); setVoiceAutoStart(false); }}
              className="mt-2 w-full text-center text-xs font-bold text-zinc-400"
            >
              Cancel listening
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
