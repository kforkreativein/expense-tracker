'use client';
import { useState, useEffect, useRef } from 'react';
import { Transaction, TxType, Frequency, Wallet, Category, SpendCategory } from '@/lib/types';
import { getWallets, addWallet, legacyWalletId, walletToPaymentMode } from '@/lib/wallets';
import { getCategories, suggestedWalletForCategory } from '@/lib/categories';
import { getSpendCategories, matchSpendCategory } from '@/lib/spendCategories';
import { findRuleForTransaction, syncRuleForTransaction } from '@/lib/recurring';
import EmojiPicker from './EmojiPicker';

interface Props {
  initial?: Transaction;
  /** Pre-filled entry that has not been saved yet (voice capture) — keeps "new entry" wording. */
  isDraft?: boolean;
  onSave: (txn: Transaction) => void;
  onCancel?: () => void;
  onRecurringChange?: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

const FREQ_LABELS: Record<Frequency, string> = {
  daily: '📅 Daily',
  weekly: '📆 Weekly',
  monthly: '🗓️ Monthly',
};

export default function TransactionForm({ initial, isDraft = false, onSave, onCancel, onRecurringChange }: Props) {
  const [type, setType] = useState<TxType>(initial?.type ?? 'expense');
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [date, setDate] = useState(initial?.date ?? today());
  const [error, setError] = useState('');

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState<string>('');
  const walletRowRef = useRef<HTMLDivElement>(null);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletEmoji, setNewWalletEmoji] = useState('💳');

  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [spendCategories, setSpendCategories] = useState<SpendCategory[]>([]);
  const [spendCategoryId, setSpendCategoryId] = useState<string>('');
  /** Once the user picks a category by hand, the note stops overriding it. */
  const [spendPickedByHand, setSpendPickedByHand] = useState(false);
  const [spendAutoMatched, setSpendAutoMatched] = useState(false);

  useEffect(() => {
    const ws = getWallets();
    const cs = getCategories();
    setWallets(ws);
    setCategories(cs);
    setSpendCategories(getSpendCategories());
    if (initial) {
      setType(initial.type);
      setAmount(String(initial.amount));
      setDescription(initial.description ?? '');
      setDate(initial.date);
      const defaultId = initial.walletId ?? legacyWalletId(initial.paymentMode, initial.bank);
      setWalletId(defaultId);
      setCategoryId(initial.categoryId ?? '');
      setSpendCategoryId(initial.spendCategoryId ?? '');
      setSpendPickedByHand(!!initial.spendCategoryId);
      setSpendAutoMatched(false);
      const rule = isDraft ? undefined : findRuleForTransaction(initial);
      setRecurring(!!rule);
      setFrequency(rule?.frequency ?? 'monthly');
    } else {
      setType('expense');
      setAmount('');
      setDescription('');
      setDate(today());
      setWalletId(ws[0]?.id ?? '');
      // Everyday entries should never start uncategorised by accident.
      setCategoryId(cs.find(c => c.name.trim().toLowerCase() === 'personal')?.id ?? '');
      setSpendCategoryId('');
      setSpendPickedByHand(false);
      setSpendAutoMatched(false);
      setRecurring(false);
      setFrequency('monthly');
    }
  }, [initial, isDraft]);

  useEffect(() => {
    if (type === 'investment') setCategoryId('');
  }, [type]);

  // With more wallets than fit on screen, the chosen one must still be visible
  useEffect(() => {
    const row = walletRowRef.current;
    if (!row || !walletId) return;
    const chip = row.querySelector<HTMLElement>(`[data-wallet-id="${CSS.escape(walletId)}"]`);
    if (!chip) return;
    const offsetLeft = chip.offsetLeft - row.offsetLeft;
    if (offsetLeft < row.scrollLeft) {
      row.scrollLeft = Math.max(0, offsetLeft - 4);
    } else if (offsetLeft + chip.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = offsetLeft + chip.offsetWidth - row.clientWidth + 4;
    }
  }, [walletId, wallets]);

  /** "Zomato dinner" picks Food on its own; tapping a chip takes over from here. */
  function handleDescriptionChange(value: string) {
    setDescription(value);
    if (spendPickedByHand || type !== 'expense') return;
    const match = matchSpendCategory(value, spendCategories);
    setSpendCategoryId(match?.id ?? '');
    setSpendAutoMatched(!!match);
  }

  function handleAddWallet() {
    const name = newWalletName.trim();
    if (!name) return;
    const w = addWallet({ name, emoji: newWalletEmoji });
    setWallets(getWallets());
    setWalletId(w.id);
    setNewWalletName('');
    setNewWalletEmoji('💳');
    setShowAddWallet(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) { setError('Please enter a valid amount'); return; }
    if (!walletId) { setError('Please select a wallet'); return; }
    setError('');

    const pm = walletToPaymentMode(walletId);
    const txn: Transaction = {
      id: initial?.id ?? crypto.randomUUID(),
      type, amount: amt,
      description: description.trim(),
      walletId,
      paymentMode: pm.paymentMode,
      bank: pm.bank,
      categoryId: (type === 'income' || type === 'expense') && categoryId ? categoryId : undefined,
      spendCategoryId: type === 'expense' && spendCategoryId ? spendCategoryId : undefined,
      recurringRuleId: initial?.recurringRuleId,
      date,
      createdAt: initial?.createdAt ?? Date.now(),
    };

    onSave(txn);
    syncRuleForTransaction(txn, recurring, frequency);
    onRecurringChange?.();
  }

  const isEdit = !!initial && !isDraft;
  const submitLabel = isEdit
    ? 'Save Changes ✅'
    : type === 'income'
      ? 'Add Income 💚'
      : type === 'investment'
        ? 'Add Investment 📈'
        : 'Add Expense ❤️';

  return (
    <form onSubmit={handleSubmit} className="clay p-5 flex flex-col gap-4 max-h-[88dvh] overflow-y-auto overscroll-contain">
      <h2 className="text-lg font-black text-stone-700 text-center">
        {isEdit ? `✏️ Edit Entry${recurring ? ' 🔄' : ''}` : isDraft ? '🎙️ Check & Save' : '➕ New Entry'}
      </h2>

      <div className="grid grid-cols-3 gap-2">
        {([
          { t: 'income' as TxType, label: '💚 Income', active: 'clay-green text-emerald-900' },
          { t: 'expense' as TxType, label: '❤️ Expense', active: 'clay-red text-red-900' },
          { t: 'investment' as TxType, label: '📈 Invest', active: 'clay-blue text-blue-900' },
        ]).map(({ t, label, active }) => (
          <button key={t} type="button"
            onClick={() => {
              setType(t);
              if (t !== 'investment' && !categoryId) {
                setCategoryId(categories.find(c => c.name.trim().toLowerCase() === 'personal')?.id ?? '');
              }
              if (t !== 'expense') {
                setSpendCategoryId('');
                setSpendAutoMatched(false);
              } else if (!spendPickedByHand) {
                const match = matchSpendCategory(description, spendCategories);
                setSpendCategoryId(match?.id ?? '');
                setSpendAutoMatched(!!match);
              }
            }}
            className={`clay-btn py-3 rounded-[14px] font-black text-sm transition-all ${
              type === t ? active : 'bg-stone-100 text-stone-400 shadow-none border border-stone-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-stone-400">₹</span>
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="0"
          className="clay w-full pl-10 pr-4 py-4 text-2xl font-black text-stone-800 bg-transparent outline-none placeholder:text-stone-300"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {[100, 500, 1000, 2000].map(v => (
          <button key={v} type="button"
            onClick={() => setAmount(String(v))}
            className={`clay-btn px-3 py-2 rounded-[10px] font-bold text-sm transition-all ${
              amount === String(v) ? 'clay-purple text-violet-900' : 'bg-stone-100 text-stone-500 border border-stone-200 shadow-none'
            }`}>
            ₹{v}
          </button>
        ))}
      </div>

      <textarea
        value={description} onChange={e => handleDescriptionChange(e.target.value)}
        placeholder="What was this for? (optional) 📝"
        rows={3}
        className="clay w-full px-4 py-3 text-base font-semibold text-stone-700 bg-transparent outline-none resize-none placeholder:text-stone-400 min-h-[80px]"
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-black text-stone-400 uppercase tracking-wider">Wallet</span>
        <div ref={walletRowRef} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {wallets.map(w => (
            <button key={w.id} type="button"
              data-wallet-id={w.id}
              onClick={() => setWalletId(w.id)}
              className={`clay-btn flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-[12px] font-bold text-sm transition-all min-h-[44px] ${
                walletId === w.id ? 'clay-blue text-blue-900' : 'bg-stone-100 text-stone-500 border border-stone-200 shadow-none'
              }`}>
              <span>{w.emoji}</span>
              <span className="whitespace-nowrap">{w.name}</span>
            </button>
          ))}
          <button type="button"
            onClick={() => setShowAddWallet(v => !v)}
            className="clay-btn flex-shrink-0 snap-start px-3 py-2.5 rounded-[12px] font-bold text-sm text-violet-600 bg-white/70 border border-violet-200 whitespace-nowrap min-h-[44px]">
            + New
          </button>
        </div>
        {showAddWallet && (
          <div className="clay animate-pop-in p-3 flex gap-2 items-center">
            <EmojiPicker value={newWalletEmoji} onChange={setNewWalletEmoji} label="Wallet icon" />
            <input
              type="text"
              value={newWalletName}
              onChange={e => setNewWalletName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddWallet()}
              placeholder="Wallet name"
              className="clay flex-1 px-3 py-2.5 font-bold text-stone-700 bg-transparent outline-none placeholder:text-stone-400"
            />
            <button type="button" onClick={handleAddWallet} disabled={!newWalletName.trim()}
              className="clay-btn bg-violet-500 text-white font-black text-sm px-3 py-2 rounded-[10px] disabled:opacity-40 min-h-[44px]">
              Add
            </button>
          </div>
        )}
      </div>

      {(type === 'income' || type === 'expense') && categories.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-black text-stone-400 uppercase tracking-wider">Type (optional)</span>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => setCategoryId('')}
              className={`clay-btn px-3 py-2.5 rounded-[12px] font-bold text-sm min-h-[44px] transition-all ${
                !categoryId ? 'clay-purple text-violet-900' : 'bg-stone-100 text-stone-500 border border-stone-200 shadow-none'
              }`}>None</button>
            {categories.map(c => (
              <button key={c.id} type="button" onClick={() => {
                setCategoryId(c.id);
                // A type can suggest its own wallet; the user can still change it below.
                setWalletId(suggestedWalletForCategory(c, wallets) ?? wallets[0]?.id ?? '');
              }}
                className={`clay-btn px-3 py-2.5 rounded-[12px] font-bold text-sm min-h-[44px] transition-all ${
                  categoryId === c.id ? 'clay-purple text-violet-900' : 'bg-stone-100 text-stone-500 border border-stone-200 shadow-none'
                }`}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {type === 'expense' && spendCategories.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs font-black text-stone-400 uppercase tracking-wider">Spent on (optional)</span>
            {spendAutoMatched && spendCategoryId && (
              <span className="text-[10px] font-black text-amber-700 animate-pop-in">✨ picked from your note</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button"
              onClick={() => { setSpendCategoryId(''); setSpendPickedByHand(true); setSpendAutoMatched(false); }}
              className={`clay-btn px-3 py-2.5 rounded-[12px] font-bold text-sm min-h-[44px] transition-all ${
                !spendCategoryId ? 'clay-amber text-amber-900' : 'bg-stone-100 text-stone-500 border border-stone-200 shadow-none'
              }`}>None</button>
            {spendCategories.map(c => (
              <button key={c.id} type="button"
                onClick={() => { setSpendCategoryId(c.id); setSpendPickedByHand(true); setSpendAutoMatched(false); }}
                className={`clay-btn px-3 py-2.5 rounded-[12px] font-bold text-sm min-h-[44px] transition-all ${
                  spendCategoryId === c.id ? 'clay-amber text-amber-900' : 'bg-stone-100 text-stone-500 border border-stone-200 shadow-none'
                }`}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        className="clay w-full px-4 py-3 text-base font-semibold text-stone-700 bg-transparent outline-none min-h-[44px]"
      />

      <div className="flex flex-col gap-2">
        <button type="button"
          onClick={() => setRecurring(v => !v)}
          className={`clay-btn flex items-center justify-between px-4 py-3 rounded-[14px] font-bold text-sm min-h-[48px] transition-all ${
            recurring ? 'clay-purple text-violet-900' : 'bg-stone-100 text-stone-500 border border-stone-200 shadow-none'
          }`}>
          <span>🔄 {isEdit ? 'Recurring rule' : 'Make this recurring'}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-black ${recurring ? 'bg-violet-200 text-violet-800' : 'bg-stone-200 text-stone-400'}`}>
            {recurring ? 'ON' : 'OFF'}
          </span>
        </button>
        {recurring && (
          <div className="grid grid-cols-3 gap-2 animate-pop-in">
            {(['daily', 'weekly', 'monthly'] as Frequency[]).map(f => (
              <button key={f} type="button"
                onClick={() => setFrequency(f)}
                className={`clay-btn py-3 rounded-[12px] font-bold text-sm min-h-[48px] transition-all ${
                  frequency === f ? 'clay-purple text-violet-900' : 'bg-stone-100 text-stone-400 border border-stone-200 shadow-none'
                }`}>
                {FREQ_LABELS[f]}
              </button>
            ))}
          </div>
        )}
        {recurring && isEdit && (
          <p className="text-[11px] font-semibold text-violet-700 px-1">Changes update the recurring rule for future entries.</p>
        )}
      </div>

      {error && <p className="text-red-500 font-bold text-sm text-center">{error}</p>}

      <div className="flex gap-2 mt-1 sticky bottom-0 bg-gradient-to-t from-[var(--input-sticky)] to-transparent pt-2 pb-1">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="clay clay-btn flex-1 py-3.5 font-bold text-stone-500 text-base min-h-[48px]">
            Cancel
          </button>
        )}
        <button type="submit"
          className={`clay-btn flex-1 py-3.5 rounded-[16px] font-black text-white text-base shadow-lg min-h-[48px] ${
            type === 'income' ? 'bg-emerald-400' : type === 'investment' ? 'bg-blue-400' : 'bg-rose-400'
          }`}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
