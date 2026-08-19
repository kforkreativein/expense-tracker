'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Subscription, SubCycle, SubCategory, STREAMING_CATALOG, CATEGORY_LABELS,
  getSubscriptions, addSubscription, updateSubscription, deleteSubscription,
  cancelSubscription, yearlyCost, daysUntil, guessSubCategory, nextPaymentFrom,
  totalSpentEstimate, subscribedLabel, CatalogItem,
} from '@/lib/subscriptions';
import { TxType, Wallet, Category } from '@/lib/types';
import { getWallets } from '@/lib/wallets';
import { getCategories } from '@/lib/categories';
import { fmt } from '@/lib/insights';
import { getProfile } from '@/lib/profile';
import { notificationsEnabled, showNotification } from '@/lib/notifications';

type View = 'hub' | 'calendar' | 'add' | 'add-form' | 'detail';
type FilterKind = 'list' | 'category' | 'cycle' | null;

interface Props {
  onClose: () => void;
  voiceEnabled?: boolean;
  onRequestVoice?: () => void;
  /** Prefill from voice: name + amount pairs */
  voiceDrafts?: { name: string; amount: number }[];
  onVoiceDraftsConsumed?: () => void;
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SubscriptionsApp({
  onClose, voiceEnabled, onRequestVoice, voiceDrafts, onVoiceDraftsConsumed,
}: Props) {
  const [view, setView] = useState<View>('hub');
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterKind, setFilterKind] = useState<FilterKind>(null);
  const [listFilter, setListFilter] = useState<'all' | 'personal' | 'business'>('all');
  const [categoryFilter, setCategoryFilter] = useState<SubCategory | 'all'>('all');
  const [cycleFilter, setCycleFilter] = useState<SubCycle | 'all'>('all');
  const [search, setSearch] = useState('');

  // add form
  const [draftName, setDraftName] = useState('');
  const [draftAmount, setDraftAmount] = useState('');
  const [draftCycle, setDraftCycle] = useState<SubCycle>('monthly');
  const [draftList, setDraftList] = useState<'personal' | 'business'>('personal');
  const [draftCategory, setDraftCategory] = useState<SubCategory>('other');
  const [draftFirst, setDraftFirst] = useState(localToday());
  const [draftEmoji, setDraftEmoji] = useState('💳');
  const [draftColor, setDraftColor] = useState('#7C3AED');
  const [draftNotify, setDraftNotify] = useState(1);
  const [draftTrial, setDraftTrial] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Auto-add to ledger (replaces the old recurring rules) — opt-in, off by default
  const [draftAutoAdd, setDraftAutoAdd] = useState(false);
  const [draftType, setDraftType] = useState<TxType>('expense');
  const [draftWalletId, setDraftWalletId] = useState('');
  const [draftCategoryId, setDraftCategoryId] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    setWallets(getWallets());
    setCategories(getCategories());
  }, []);

  function reload() {
    const list = getSubscriptions().map(s => {
      const next = nextPaymentFrom(s.firstPayment, s.cycle);
      if (next !== s.nextPayment && !s.cancelled) {
        updateSubscription(s.id, { nextPayment: next });
        return { ...s, nextPayment: next };
      }
      return s;
    });
    setSubs(getSubscriptions());

    // Renewal nudges
    if (notificationsEnabled() && getProfile().reminders.subscription) {
      for (const s of list) {
        if (s.cancelled) continue;
        const d = daysUntil(s.nextPayment);
        if (d === s.notifyDaysBefore || d === 0) {
          const key = `sub_notif_${s.id}_${s.nextPayment}`;
          if (!sessionStorage.getItem(key)) {
            showNotification('Money Buddy', `${s.name} renews ${d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`} · ${fmt(s.amount)}`);
            sessionStorage.setItem(key, '1');
          }
        }
      }
    }
  }

  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (!voiceDrafts?.length) return;
    for (const d of voiceDrafts) {
      const cat = guessSubCategory(d.name);
      const catalog = STREAMING_CATALOG.find(c => c.name.toLowerCase() === d.name.toLowerCase());
      addSubscription({
        name: d.name,
        amount: d.amount,
        currency: 'INR',
        cycle: 'monthly',
        list: 'personal',
        category: catalog?.category ?? cat,
        firstPayment: localToday(),
        duration: 'forever',
        freeTrial: false,
        notifyDaysBefore: 1,
        emoji: catalog?.emoji ?? '💳',
        color: catalog?.color ?? '#7C3AED',
        cancelled: false,
      });
    }
    onVoiceDraftsConsumed?.();
    reload();
    setView('hub');
  }, [voiceDrafts, onVoiceDraftsConsumed]);

  const active = useMemo(() => subs.filter(s => !s.cancelled), [subs]);
  const filtered = useMemo(() => {
    return active.filter(s => {
      if (listFilter !== 'all' && s.list !== listFilter) return false;
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (cycleFilter !== 'all' && s.cycle !== cycleFilter) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => a.nextPayment.localeCompare(b.nextPayment));
  }, [active, listFilter, categoryFilter, cycleFilter, search]);

  const yearlyTotal = useMemo(() => filtered.reduce((s, x) => s + yearlyCost(x), 0), [filtered]);
  const selected = subs.find(s => s.id === selectedId) ?? null;

  function openCatalog(item: CatalogItem) {
    setDraftName(item.name);
    setDraftAmount(item.defaultAmount ? String(item.defaultAmount) : '');
    setDraftEmoji(item.emoji);
    setDraftColor(item.color);
    setDraftCategory(item.category);
    setDraftCycle('monthly');
    setDraftFirst(localToday());
    setDraftList('personal');
    setDraftNotify(1);
    setDraftTrial(false);
    setDraftAutoAdd(false);
    setDraftType('expense');
    setDraftWalletId(wallets[0]?.id ?? '');
    setDraftCategoryId('');
    setView('add-form');
  }

  function openManual(name = '', amount = '', editId: string | null = null) {
    setEditingId(editId);
    setDraftName(name);
    setDraftAmount(amount);
    setDraftEmoji('💳');
    setDraftColor('#7C3AED');
    setDraftCategory(guessSubCategory(name));
    setDraftCycle('monthly');
    setDraftFirst(localToday());
    setDraftList('personal');
    setDraftNotify(1);
    setDraftTrial(false);
    setDraftAutoAdd(false);
    setDraftType('expense');
    setDraftWalletId(wallets[0]?.id ?? '');
    setDraftCategoryId('');
    if (editId) {
      const s = getSubscriptions().find(x => x.id === editId);
      if (s) {
        setDraftName(s.name);
        setDraftAmount(String(s.amount));
        setDraftEmoji(s.emoji);
        setDraftColor(s.color);
        setDraftCategory(s.category);
        setDraftCycle(s.cycle);
        setDraftFirst(s.firstPayment);
        setDraftList(s.list);
        setDraftNotify(s.notifyDaysBefore);
        setDraftTrial(s.freeTrial);
        setDraftAutoAdd(!!(s.type && s.walletId));
        setDraftType(s.type ?? 'expense');
        setDraftWalletId(s.walletId ?? wallets[0]?.id ?? '');
        setDraftCategoryId(s.categoryId ?? '');
      }
    }
    setView('add-form');
  }

  function saveDraft() {
    const amount = Number(draftAmount);
    if (!draftName.trim() || !(amount > 0)) return;
    const ledgerFields = draftAutoAdd
      ? { type: draftType, walletId: draftWalletId || wallets[0]?.id, categoryId: draftCategoryId || undefined }
      : { type: undefined, walletId: undefined, categoryId: undefined };
    if (editingId) {
      updateSubscription(editingId, {
        name: draftName.trim(),
        amount,
        cycle: draftCycle,
        list: draftList,
        category: draftCategory,
        firstPayment: draftFirst,
        nextPayment: nextPaymentFrom(draftFirst, draftCycle),
        freeTrial: draftTrial,
        notifyDaysBefore: draftNotify,
        emoji: draftEmoji,
        color: draftColor,
        ...ledgerFields,
      });
      setEditingId(null);
    } else {
      addSubscription({
        name: draftName.trim(),
        amount,
        currency: 'INR',
        cycle: draftCycle,
        list: draftList,
        category: draftCategory,
        firstPayment: draftFirst,
        duration: 'forever',
        freeTrial: draftTrial,
        notifyDaysBefore: draftNotify,
        emoji: draftEmoji,
        color: draftColor,
        cancelled: false,
        ...ledgerFields,
      });
    }
    reload();
    setView('hub');
  }

  // ── ADD CHOOSER ──
  if (view === 'add') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <button type="button" onClick={() => setView('hub')} className="rounded-full bg-zinc-800 px-4 py-2 text-sm font-bold text-white min-h-[40px]">Cancel</button>
          <h2 className="text-base font-black text-white">Add Subscription</h2>
          <button type="button" onClick={() => openManual()} className="rounded-xl bg-zinc-800 p-2 text-white min-h-[40px] min-w-[40px]" aria-label="Manual">✏️</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-28">
          <div className="rounded-[16px] bg-[#16161c] divide-y divide-white/8 overflow-hidden mb-6">
            {voiceEnabled && (
              <button type="button" onClick={() => onRequestVoice?.()} className="flex w-full items-center gap-3 px-4 py-4 text-left min-h-[64px]">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/30 text-lg">🎙️</span>
                <div>
                  <p className="font-bold text-white">Add by voice</p>
                  <p className="text-xs text-zinc-500">“Netflix 649 and Spotify 59”</p>
                </div>
              </button>
            )}
            <button type="button" onClick={() => openManual()} className="flex w-full items-center gap-3 px-4 py-4 text-left min-h-[64px]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/30 text-lg">✨</span>
              <div>
                <p className="font-bold text-white">Type or paste</p>
                <p className="text-xs text-zinc-500">Name, price and how often you pay.</p>
              </div>
            </button>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 mb-2 px-1">Streaming</p>
          <div className="rounded-[16px] bg-[#16161c] divide-y divide-white/8 overflow-hidden">
            {STREAMING_CATALOG.map(item => (
              <button key={item.name} type="button" onClick={() => openCatalog(item)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left min-h-[52px]">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ background: item.color + '33' }}>{item.emoji}</span>
                <span className="flex-1 font-semibold text-white">{item.name}</span>
                <span className="text-zinc-500">›</span>
              </button>
            ))}
          </div>
        </div>
        <div className="fixed inset-x-0 bottom-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 bg-gradient-to-t from-[#0a0a0f] to-transparent">
          <div className="flex items-center gap-2 rounded-full bg-[#1c1c22] px-4 py-3 border border-white/10">
            <span className="text-zinc-500">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search"
              className="flex-1 bg-transparent outline-none text-white placeholder:text-zinc-500" />
          </div>
        </div>
      </div>
    );
  }

  // ── ADD FORM ──
  if (view === 'add-form') {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col overflow-y-auto" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <button type="button" onClick={() => { setEditingId(null); setView('add'); }} className="text-white text-xl min-h-[44px] px-1">‹</button>
          <h2 className="text-base font-black text-white">Add Subscription</h2>
          <button type="button" onClick={saveDraft} className="rounded-full bg-violet-600 px-4 py-2 text-sm font-black text-white min-h-[40px]">Save</button>
        </div>
        <div className="px-4 pb-10 flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-[16px] bg-[#16161c] px-4 py-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ background: draftColor + '44' }}>{draftEmoji}</span>
            <input value={draftName} onChange={e => { setDraftName(e.target.value); setDraftCategory(guessSubCategory(e.target.value)); }}
              placeholder="Name" className="flex-1 bg-transparent text-lg font-black text-white outline-none" />
            <div className="flex items-center gap-1 rounded-xl bg-violet-900/40 px-2 py-1.5">
              <span className="text-violet-300 text-sm">₹</span>
              <input value={draftAmount} onChange={e => setDraftAmount(e.target.value.replace(/[^\d.]/g, ''))}
                inputMode="decimal" placeholder="0.00" className="w-20 bg-transparent text-right font-bold text-white outline-none" />
            </div>
          </div>

          <div className="rounded-[16px] bg-[#16161c] divide-y divide-white/8 overflow-hidden">
            <label className="flex items-center justify-between px-4 py-3.5 min-h-[52px]">
              <span className="text-zinc-400 text-sm">First payment date</span>
              <input type="date" value={draftFirst} onChange={e => setDraftFirst(e.target.value)}
                className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white outline-none" />
            </label>
            <div className="flex items-center justify-between px-4 py-3.5 min-h-[52px]">
              <span className="text-zinc-400 text-sm">Cycle</span>
              <select value={draftCycle} onChange={e => setDraftCycle(e.target.value as SubCycle)}
                className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white outline-none">
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
                <option value="yearly">Every year</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5 min-h-[52px]">
              <span className="text-zinc-400 text-sm">Free Trial</span>
              <button type="button" role="switch" aria-checked={draftTrial} onClick={() => setDraftTrial(v => !v)}
                className={`relative h-7 w-12 rounded-full ${draftTrial ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${draftTrial ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          <div className="rounded-[16px] bg-[#16161c] divide-y divide-white/8 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 min-h-[52px]">
              <span className="text-zinc-400 text-sm">List</span>
              <select value={draftList} onChange={e => setDraftList(e.target.value as 'personal' | 'business')}
                className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white outline-none">
                <option value="personal">Personal</option>
                <option value="business">Business</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5 min-h-[52px]">
              <span className="text-zinc-400 text-sm">Category</span>
              <select value={draftCategory} onChange={e => setDraftCategory(e.target.value as SubCategory)}
                className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white outline-none">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-[16px] bg-[#16161c] px-4 py-3.5 flex items-center justify-between min-h-[52px]">
            <span className="text-zinc-400 text-sm">Notification</span>
            <select value={draftNotify} onChange={e => setDraftNotify(Number(e.target.value))}
              className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white outline-none">
              <option value={0}>Same day</option>
              <option value={1}>1 day before</option>
              <option value={3}>3 days before</option>
              <option value={7}>1 week before</option>
            </select>
          </div>

          <div className="rounded-[16px] bg-[#16161c] divide-y divide-white/8 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 min-h-[52px]">
              <div>
                <p className="text-white text-sm font-semibold">Auto-add to ledger</p>
                <p className="text-zinc-500 text-xs">Adds a transaction every cycle, like rent or an EMI.</p>
              </div>
              <button type="button" role="switch" aria-checked={draftAutoAdd} onClick={() => setDraftAutoAdd(v => !v)}
                className={`relative h-7 w-12 shrink-0 rounded-full ${draftAutoAdd ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${draftAutoAdd ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
            {draftAutoAdd && (
              <>
                <div className="flex items-center justify-between px-4 py-3.5 min-h-[52px]">
                  <span className="text-zinc-400 text-sm">Type</span>
                  <div className="flex gap-1.5">
                    {([
                      { t: 'expense' as TxType, label: 'Expense' },
                      { t: 'income' as TxType, label: 'Income' },
                      { t: 'investment' as TxType, label: 'Invest' },
                    ]).map(({ t, label }) => (
                      <button key={t} type="button" onClick={() => setDraftType(t)}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${draftType === t ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-3.5 min-h-[52px]">
                  <span className="text-zinc-400 text-sm">Wallet</span>
                  <select value={draftWalletId} onChange={e => setDraftWalletId(e.target.value)}
                    className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white outline-none">
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between px-4 py-3.5 min-h-[52px]">
                  <span className="text-zinc-400 text-sm">Type (pocket)</span>
                  <select value={draftCategoryId} onChange={e => setDraftCategoryId(e.target.value)}
                    className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-bold text-white outline-none">
                    <option value="">None</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── DETAIL ──
  if (view === 'detail' && selected) {
    const d = daysUntil(selected.nextPayment);
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0612] flex flex-col overflow-y-auto" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-600" />
        <div className="flex justify-end px-4 pt-2">
          <button type="button" onClick={() => openManual(selected.name, String(selected.amount), selected.id)}
            className="rounded-full bg-violet-700/50 px-3 py-1.5 text-xs font-bold text-violet-200">Edit</button>
        </div>
        <div className="flex flex-col items-center px-4 pt-2 pb-4">
          <span className="flex h-20 w-20 items-center justify-center rounded-[28px] text-4xl" style={{ background: selected.color + '44' }}>{selected.emoji}</span>
          <h2 className="mt-3 text-2xl font-black text-white">{selected.name}</h2>
          <p className="text-lg font-bold text-white">{fmt(selected.amount)}</p>
        </div>
        <div className="mx-4 rounded-[16px] bg-[#16121f] divide-y divide-white/8 overflow-hidden">
          {[
            ['Billing', selected.cycle === 'daily' ? 'Daily' : selected.cycle === 'weekly' ? 'Weekly' : selected.cycle === 'yearly' ? 'Yearly' : 'Monthly'],
            ['Next payment', fmtDate(selected.nextPayment)],
            ['Total spent', fmt(totalSpentEstimate(selected))],
            ['Subscribed', subscribedLabel(selected)],
            ['Category', CATEGORY_LABELS[selected.category]],
            ['List', selected.list === 'business' ? 'Business' : 'Personal'],
            ['Ledger', selected.type && selected.walletId
              ? `Auto-added · ${wallets.find(w => w.id === selected.walletId)?.name ?? selected.walletId}`
              : 'Reminder only'],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between px-4 py-3.5 text-sm min-h-[48px]">
              <span className="text-zinc-500">{l}</span>
              <span className="font-semibold text-white">{v}</span>
            </div>
          ))}
        </div>
        <div className="mx-4 mt-4 rounded-[16px] bg-[#16121f] p-4">
          <p className="text-sm font-bold text-white mb-2">Billing History</p>
          {selected.history.map((h, i) => (
            <div key={i} className="flex justify-between py-2 text-sm border-t border-white/5 first:border-0">
              <span className="text-zinc-500">{fmtDate(h.date)}</span>
              <span className="text-zinc-300">{h.note}</span>
            </div>
          ))}
          <p className="text-xs text-zinc-600 mt-2">{d >= 0 ? `Renews in ${d} day${d === 1 ? '' : 's'}` : 'Overdue'}</p>
        </div>
        <div className="px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-2">
          {!selected.cancelled && (
            <button type="button" onClick={() => { cancelSubscription(selected.id); reload(); setView('hub'); }}
              className="w-full rounded-full bg-violet-600 py-4 font-black text-white min-h-[52px]">Mark as Cancelled</button>
          )}
          <button type="button" onClick={() => { deleteSubscription(selected.id); reload(); setView('hub'); }}
            className="w-full py-3 text-sm font-semibold text-violet-300/70">Delete subscription</button>
          <button type="button" onClick={() => setView('hub')} className="w-full py-2 text-sm text-zinc-500">Close</button>
        </div>
      </div>
    );
  }

  // ── CALENDAR ──
  if (view === 'calendar') {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startPad = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
    const monthLabel = now.toLocaleDateString('en-IN', { month: 'long' });
    const byDay: Record<number, Subscription[]> = {};
    for (const s of active) {
      const d = new Date(s.nextPayment + 'T12:00:00');
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        (byDay[day] ??= []).push(s);
      }
    }
    const monthTotal = Object.values(byDay).flat().reduce((a, s) => a + s.amount, 0);
    const upcoming = active.filter(s => daysUntil(s.nextPayment) >= 0 && daysUntil(s.nextPayment) <= 14)
      .reduce((a, s) => a + s.amount, 0);

    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="px-4 pt-2 flex-1 overflow-y-auto pb-28">
          <h1 className="text-[32px] font-black text-white">{monthLabel}</h1>
          <p className="text-white font-bold mt-1">{fmt(monthTotal)} <span className="text-zinc-500 font-semibold">Total</span></p>
          <p className="text-zinc-400 text-sm">{fmt(upcoming)} Upcoming</p>
          <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] text-zinc-500 mb-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const items = byDay[day] ?? [];
              const isToday = day === now.getDate();
              return (
                <div
                  key={day}
                  className={`min-h-[64px] rounded-[12px] p-1 flex flex-col items-center ${isToday ? 'bg-violet-800/60' : 'bg-[#16161c]'}`}
                >
                  <span className="text-[11px] font-bold text-zinc-300">{day}</span>
                  <div className="mt-0.5 flex flex-col items-center gap-0.5">
                    {items.slice(0, 2).map(s => (
                      <span key={s.id} className="text-sm leading-none" title={s.name}>{s.emoji}</span>
                    ))}
                    {items.length > 2 && <span className="text-[9px] text-zinc-400">+{items.length - 2}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <SubBottomNav view="calendar" onHub={() => setView('hub')} onCalendar={() => setView('calendar')} onClose={onClose} />
      </div>
    );
  }

  // ── HUB ──
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 18%, #4c1d95 0%, #1a0a2e 42%, #050508 75%)',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
      }}>
      {/* stars */}
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i} className="absolute h-0.5 w-0.5 rounded-full bg-white"
            style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 55}%`, opacity: 0.3 + (i % 5) * 0.12 }} />
        ))}
      </div>

      <div className="relative flex justify-end px-4 pt-2">
        <button type="button" onClick={() => setView('add')} aria-label="Add" className="flex h-10 w-10 items-center justify-center rounded-full text-white text-2xl bg-white/10">+</button>
      </div>

      <div className="relative flex flex-col items-center pt-2 pb-4">
        <div className="relative h-36 w-36">
          <div className="absolute inset-0 rounded-full opacity-80"
            style={{ background: 'radial-gradient(circle at 40% 35%, #fb923c, #ec4899 45%, #7c3aed 80%)', boxShadow: '0 0 60px rgba(236,72,153,0.45)' }} />
          {[52, 68, 84].map((r, i) => (
            <div key={r} className="absolute rounded-full border border-white/15"
              style={{ inset: `${(136 - r * 2) / 2}px` }} />
          ))}
          {[0, 1, 2, 3, 4].map(i => (
            <span key={i} className="absolute h-2 w-2 rounded-full bg-white/80"
              style={{ left: `${50 + Math.cos(i * 1.4) * 42}%`, top: `${50 + Math.sin(i * 1.4) * 42}%` }} />
          ))}
        </div>
        <div className="mt-4 flex w-full max-w-sm items-end justify-between px-6">
          <button type="button" onClick={() => setFilterOpen(v => !v)} className="text-left">
            <p className="text-3xl font-black text-white">{filtered.length}</p>
            <p className="text-sm text-zinc-400 flex items-center gap-1">
              {listFilter === 'all' ? 'All' : listFilter === 'personal' ? 'Personal' : 'Business'} ↕
            </p>
          </button>
          <div className="text-right">
            <p className="text-2xl font-black text-white">{fmt(Math.round(yearlyTotal))}</p>
            <p className="text-sm text-zinc-400">Total yearly</p>
          </div>
        </div>
      </div>

      {filterOpen && (
        <div className="relative mx-4 mb-3 rounded-[16px] bg-[#1c1c1e]/95 border border-white/10 overflow-hidden backdrop-blur-xl animate-pop-in">
          {[
            { id: 'list' as const, icon: '☰', label: 'Lists' },
            { id: 'category' as const, icon: '▦', label: 'Categories' },
            { id: 'cycle' as const, icon: '📅', label: 'Billing Cycle' },
          ].map(f => (
            <button key={f.id} type="button" onClick={() => setFilterKind(filterKind === f.id ? null : f.id)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left border-b border-white/8 last:border-0 min-h-[48px]">
              <span>{f.icon}</span>
              <span className="flex-1 font-semibold text-white">{f.label}</span>
              <span className="text-zinc-500">›</span>
            </button>
          ))}
          {filterKind === 'list' && (
            <div className="flex gap-2 px-4 py-3 bg-black/30">
              {(['all', 'personal', 'business'] as const).map(v => (
                <button key={v} type="button" onClick={() => { setListFilter(v); setFilterOpen(false); setFilterKind(null); }}
                  className={`rounded-full px-3 py-2 text-xs font-bold capitalize min-h-[36px] ${listFilter === v ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>{v}</button>
              ))}
            </div>
          )}
          {filterKind === 'category' && (
            <div className="flex flex-wrap gap-2 px-4 py-3 bg-black/30">
              <button type="button" onClick={() => { setCategoryFilter('all'); setFilterOpen(false); setFilterKind(null); }}
                className={`rounded-full px-3 py-2 text-xs font-bold ${categoryFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>All</button>
              {(Object.keys(CATEGORY_LABELS) as SubCategory[]).map(c => (
                <button key={c} type="button" onClick={() => { setCategoryFilter(c); setFilterOpen(false); setFilterKind(null); }}
                  className={`rounded-full px-3 py-2 text-xs font-bold ${categoryFilter === c ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>{CATEGORY_LABELS[c]}</button>
              ))}
            </div>
          )}
          {filterKind === 'cycle' && (
            <div className="flex gap-2 px-4 py-3 bg-black/30">
              {(['all', 'weekly', 'monthly', 'yearly'] as const).map(v => (
                <button key={v} type="button" onClick={() => { setCycleFilter(v); setFilterOpen(false); setFilterKind(null); }}
                  className={`rounded-full px-3 py-2 text-xs font-bold capitalize ${cycleFilter === v ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>{v}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative flex-1 overflow-y-auto px-4 pb-28">
        <button type="button" onClick={() => setView('add')}
          className="mb-3 flex w-full items-center gap-3 rounded-[16px] bg-[#1c1c1e]/80 border border-white/8 px-4 py-3.5 text-left min-h-[56px]">
          <span className="text-2xl">👋</span>
          <div className="flex-1">
            <p className="font-bold text-white">Get started guide</p>
            <p className="text-xs text-zinc-500">Save money.</p>
          </div>
          <span className="text-zinc-500">›</span>
        </button>

        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-sm font-bold text-zinc-400">Active</span>
          <span className="text-sm font-bold text-zinc-500">Next ↕</span>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 py-10">No subscriptions yet. Tap + to add one.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(s => {
              const d = daysUntil(s.nextPayment);
              return (
                <button key={s.id} type="button" onClick={() => { setSelectedId(s.id); setView('detail'); }}
                  className="flex items-center gap-3 rounded-[16px] bg-[#1c1c1e]/85 border border-white/8 px-3 py-3 text-left min-h-[64px]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl shrink-0" style={{ background: s.color + '33' }}>{s.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{s.name}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      Renews in {d} day{d === 1 ? '' : 's'} · {fmtDate(s.nextPayment)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-white">{fmt(s.amount)}</p>
                    <span className="text-zinc-500 text-sm">›</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <SubBottomNav view="hub" onHub={() => setView('hub')} onCalendar={() => setView('calendar')} onClose={onClose} />
    </div>
  );
}

function SubBottomNav({
  view, onHub, onCalendar, onClose,
}: {
  view: 'hub' | 'calendar';
  onHub: () => void;
  onCalendar: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
      <nav className="pointer-events-auto flex h-[54px] items-center gap-1 rounded-full border border-white/10 bg-[#1c1c1e]/90 px-2 backdrop-blur-xl shadow-lg">
        <button type="button" onClick={onHub} aria-label="Subscriptions"
          className={`flex h-11 w-11 items-center justify-center rounded-full ${view === 'hub' ? 'bg-white/15 text-white' : 'text-zinc-500'}`}>
          ◐
        </button>
        <button type="button" onClick={onCalendar} aria-label="Calendar"
          className={`flex h-11 w-11 items-center justify-center rounded-full ${view === 'calendar' ? 'bg-white/15 text-white' : 'text-zinc-500'}`}>
          📅
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500">
          ⚙️
        </button>
      </nav>
    </div>
  );
}
