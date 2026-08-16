'use client';
import { useMemo, useState } from 'react';
import { Category, SpendCategory, Transaction, TxType, Wallet } from '@/lib/types';
import { getWallets, walletToPaymentMode } from '@/lib/wallets';
import { getCategories } from '@/lib/categories';
import { getSpendCategories } from '@/lib/spendCategories';
import { getTransactions } from '@/lib/storage';
import { getTransfers } from '@/lib/transfers';
import { draftsFromParsed } from '@/lib/voice/sanitize';
import { mostUsedWalletId } from '@/lib/voice/client';
import { answerQuery } from '@/lib/voice/answer';
import { VoiceResult } from '@/lib/voice/types';
import TransactionForm from './TransactionForm';

interface Props {
  result: VoiceResult;
  onSaveAll: (txns: Transaction[]) => void;
  onClose: () => void;
}

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN')}`;
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const TYPE_META: Record<TxType, { label: string; emoji: string; card: string; active: string }> = {
  income: { label: 'Income', emoji: '💰', card: 'transaction-card--income', active: 'clay-green text-emerald-900' },
  expense: { label: 'Expense', emoji: '💸', card: 'transaction-card--expense', active: 'clay-red text-red-900' },
  investment: { label: 'Invest', emoji: '📈', card: 'transaction-card--investment', active: 'clay-blue text-blue-900' },
};

export default function VoiceConfirmSheet({ result, onSaveAll, onClose }: Props) {
  // Read once: the sheet is remounted for every new recording
  const [lists] = useState<{ wallets: Wallet[]; types: Category[]; spendCategories: SpendCategory[] }>(() => ({
    wallets: getWallets(),
    types: getCategories(),
    spendCategories: getSpendCategories(),
  }));
  const { wallets, types, spendCategories } = lists;

  const [drafts, setDrafts] = useState<Transaction[]>(() => draftsFromParsed(result.entries, {
    wallets: lists.wallets,
    types: lists.types,
    spendCategories: lists.spendCategories,
    fallbackWalletId: mostUsedWalletId(),
    fallbackTypeId: lists.types.find(c => c.name.trim().toLowerCase() === 'personal')?.id ?? null,
  }));

  const answer = useMemo(() => {
    if (result.intent !== 'query' || !result.query) return null;
    return answerQuery({
      query: result.query,
      transactions: getTransactions(),
      transfers: getTransfers(),
      wallets,
      types,
      spendCategories,
    });
  }, [result, wallets, types, spendCategories]);

  function patch(id: string, changes: Partial<Transaction>) {
    setDrafts(prev => prev.map(d => {
      if (d.id !== id) return d;
      const next = { ...d, ...changes };
      if (changes.walletId) {
        const pm = walletToPaymentMode(changes.walletId);
        next.paymentMode = pm.paymentMode;
        next.bank = pm.bank;
      }
      if (next.type !== 'expense') next.spendCategoryId = undefined;
      if (next.type === 'investment') next.categoryId = undefined;
      return next;
    }));
  }

  function remove(id: string) {
    setDrafts(prev => prev.filter(d => d.id !== id));
  }

  const totals = drafts.reduce(
    (acc, d) => ({ ...acc, [d.type]: acc[d.type] + d.amount }),
    { income: 0, expense: 0, investment: 0 } as Record<TxType, number>,
  );
  const invalid = drafts.some(d => !d.amount || d.amount <= 0 || !d.walletId);

  const transcript = result.transcript.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="w-full max-w-sm max-h-[92dvh] overflow-y-auto overscroll-contain animate-slide-up rounded-t-[24px] sm:rounded-[24px]"
        onClick={e => e.stopPropagation()}>

        {/* One entry: the normal form, already filled in */}
        {drafts.length === 1 ? (
          <div className="flex flex-col gap-2">
            {transcript && <TranscriptCard text={transcript} />}
            <TransactionForm
              initial={drafts[0]}
              isDraft
              onSave={txn => onSaveAll([txn])}
              onCancel={onClose}
            />
          </div>
        ) : (
          <div className="clay p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-black text-stone-700">
                {answer ? '🎙️ Here you go' : drafts.length > 1 ? `🎙️ ${drafts.length} entries` : '🎙️ Voice entry'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="clay-btn w-10 h-10 rounded-[12px] text-stone-500 font-black">✕</button>
            </div>

            {transcript && <TranscriptCard text={transcript} />}

            {answer && (
              <div className="flex flex-col gap-3">
                <div className="clay clay-amber p-4 flex flex-col gap-1 text-center">
                  <p className="text-xs font-black text-amber-900/80 uppercase tracking-wide">
                    {answer.title} · {answer.periodLabel}
                  </p>
                  <p className="text-3xl font-black text-amber-900">{fmt(answer.amount)}</p>
                  <p className="text-[11px] font-bold text-amber-900/70">
                    {answer.count === 0
                      ? 'No entries found'
                      : `${answer.count} ${answer.count === 1 ? 'entry' : 'entries'}`}
                  </p>
                </div>

                {answer.limit != null && (
                  <div className="clay p-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-stone-500">Monthly limit</span>
                      <span className={answer.amount > answer.limit ? 'text-rose-500' : 'text-stone-600'}>
                        {fmt(answer.amount)} / {fmt(answer.limit)}
                      </span>
                    </div>
                    <div className="budget-meter__track">
                      <div
                        className={`budget-meter__fill${answer.amount > answer.limit ? ' is-over' : ''}`}
                        style={{ width: `${Math.min(100, (answer.amount / answer.limit) * 100)}%` }}
                      />
                    </div>
                    {answer.amount > answer.limit && (
                      <p className="text-[11px] font-bold text-rose-500">
                        Over by {fmt(answer.amount - answer.limit)}
                      </p>
                    )}
                  </div>
                )}

                {answer.transactions.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-black text-stone-400 uppercase tracking-wider px-1">
                      Biggest ones
                    </span>
                    {[...answer.transactions]
                      .sort((a, b) => b.amount - a.amount)
                      .slice(0, 5)
                      .map(t => (
                        <div key={t.id} className="clay flex items-center gap-2 px-3 py-2.5">
                          <span className="text-sm font-bold text-stone-700 flex-1 truncate">
                            {t.description || 'No note'}
                          </span>
                          <span className="text-[11px] font-semibold text-stone-400 shrink-0">{fmtDate(t.date)}</span>
                          <span className="text-sm font-black text-stone-700 shrink-0">{fmt(t.amount)}</span>
                        </div>
                      ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="clay-btn clay-purple clay w-full py-3.5 font-black text-violet-900 min-h-[48px]">
                  Got it 👍
                </button>
              </div>
            )}

            {/* Nothing usable came back */}
            {!answer && drafts.length === 0 && (
              <div className="flex flex-col gap-3">
                <div className="clay p-4 flex flex-col items-center gap-2 text-center">
                  <span className="text-4xl" aria-hidden>🤔</span>
                  <p className="font-black text-stone-700">
                    {result.note || 'I could not turn that into an entry.'}
                  </p>
                </div>
                <div className="clay p-3 flex flex-col gap-1.5">
                  <p className="text-xs font-black text-stone-500 uppercase tracking-wide">Try saying</p>
                  {[
                    '“Spent 250 on chai from HDFC”',
                    '“Got 20000 salary”',
                    '“How much did I spend on food this month?”',
                  ].map(example => (
                    <p key={example} className="text-xs font-semibold text-stone-500">{example}</p>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="clay-btn clay w-full py-3.5 font-bold text-stone-500 min-h-[48px]">
                  Close
                </button>
              </div>
            )}

            {/* Several entries: stacked, each one editable */}
            {drafts.length > 1 && (
              <>
                <div className="flex flex-col gap-3">
                  {drafts.map((draft, index) => (
                    <DraftCard
                      key={draft.id}
                      index={index + 1}
                      draft={draft}
                      wallets={wallets}
                      types={types}
                      spendCategories={spendCategories}
                      onChange={changes => patch(draft.id, changes)}
                      onRemove={() => remove(draft.id)}
                    />
                  ))}
                </div>

                <div className="clay p-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-stone-500 uppercase tracking-wide">Total</span>
                  <div className="flex gap-2 flex-wrap justify-end text-sm font-black">
                    {totals.expense > 0 && <span className="text-rose-500">-{fmt(totals.expense)}</span>}
                    {totals.income > 0 && <span className="text-emerald-600">+{fmt(totals.income)}</span>}
                    {totals.investment > 0 && <span className="text-blue-600">↑{fmt(totals.investment)}</span>}
                  </div>
                </div>

                {invalid && (
                  <p className="text-xs font-bold text-rose-500 text-center">
                    Every entry needs an amount and a wallet.
                  </p>
                )}

                <div className="flex gap-2 sticky bottom-0 bg-gradient-to-t from-[var(--input-sticky)] to-transparent pt-2 pb-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="clay clay-btn flex-1 py-3.5 font-bold text-stone-500 min-h-[48px]">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={invalid}
                    onClick={() => onSaveAll(drafts.map(d => ({ ...d, createdAt: Date.now() })))}
                    className="clay-btn flex-1 py-3.5 rounded-[16px] font-black text-white shadow-lg min-h-[48px] bg-violet-500 disabled:opacity-40">
                    Save all {drafts.length} ✅
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TranscriptCard({ text }: { text: string }) {
  return (
    <div className="clay clay-amber px-4 py-3 flex items-start gap-2">
      <span className="text-base leading-none mt-0.5" aria-hidden>🎙️</span>
      <p className="text-sm font-bold text-amber-900 flex-1">“{text}”</p>
    </div>
  );
}

interface DraftCardProps {
  index: number;
  draft: Transaction;
  wallets: Wallet[];
  types: Category[];
  spendCategories: SpendCategory[];
  onChange: (changes: Partial<Transaction>) => void;
  onRemove: () => void;
}

function DraftCard({ index, draft, wallets, types, spendCategories, onChange, onRemove }: DraftCardProps) {
  const meta = TYPE_META[draft.type];

  return (
    <div className={`transaction-card ${meta.card} animate-pop-in p-3.5 rounded-[18px] flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-stone-100 border border-stone-200 text-[11px] font-black text-stone-500 flex items-center justify-center shrink-0">
          {index}
        </span>
        <span className="text-sm font-black text-stone-700 flex-1 truncate">
          {meta.emoji} {draft.description || 'No note'}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove entry ${index}`}
          className="clay-btn text-rose-400 font-black text-xs px-2 py-1 rounded-[8px] bg-white border border-rose-100 min-h-[32px]">
          ✕
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {(Object.keys(TYPE_META) as TxType[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ type: t })}
            className={`clay-btn py-2 rounded-[10px] font-black text-[11px] min-h-[36px] transition-all ${
              draft.type === t ? TYPE_META[t].active : 'bg-stone-100 text-stone-400 border border-stone-200 shadow-none'
            }`}>
            {TYPE_META[t].label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative w-[42%]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-black text-stone-400">₹</span>
          <input
            type="text"
            inputMode="numeric"
            value={draft.amount ? String(draft.amount) : ''}
            onChange={e => onChange({ amount: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
            placeholder="0"
            aria-label={`Amount for entry ${index}`}
            className="clay w-full pl-7 pr-2 py-2.5 text-base font-black text-stone-800 bg-transparent outline-none placeholder:text-stone-300"
          />
        </div>
        <input
          type="date"
          value={draft.date}
          onChange={e => onChange({ date: e.target.value })}
          aria-label={`Date for entry ${index}`}
          className="clay flex-1 px-2.5 py-2.5 text-sm font-semibold text-stone-700 bg-transparent outline-none min-h-[44px]"
        />
      </div>

      <input
        type="text"
        value={draft.description}
        onChange={e => onChange({ description: e.target.value })}
        placeholder="What was this for?"
        aria-label={`Note for entry ${index}`}
        className="clay w-full px-3 py-2.5 text-sm font-semibold text-stone-700 bg-transparent outline-none placeholder:text-stone-400 min-h-[44px]"
      />

      <div className="flex gap-2">
        <select
          value={draft.walletId ?? ''}
          onChange={e => onChange({ walletId: e.target.value })}
          aria-label={`Wallet for entry ${index}`}
          className="clay flex-1 min-w-0 px-2.5 py-2.5 text-sm font-bold text-stone-700 bg-transparent outline-none min-h-[44px]">
          {wallets.map(w => (
            <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>
          ))}
        </select>
        {draft.type === 'expense' && spendCategories.length > 0 && (
          <select
            value={draft.spendCategoryId ?? ''}
            onChange={e => onChange({ spendCategoryId: e.target.value || undefined })}
            aria-label={`Spending category for entry ${index}`}
            className="clay flex-1 min-w-0 px-2.5 py-2.5 text-sm font-bold text-stone-700 bg-transparent outline-none min-h-[44px]">
            <option value="">Spent on…</option>
            {spendCategories.map(c => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
          </select>
        )}
      </div>

      {draft.type !== 'investment' && types.length > 0 && (
        <select
          value={draft.categoryId ?? ''}
          onChange={e => onChange({ categoryId: e.target.value || undefined })}
          aria-label={`Type for entry ${index}`}
          className="clay w-full px-2.5 py-2.5 text-sm font-bold text-stone-700 bg-transparent outline-none min-h-[44px]">
          <option value="">No type</option>
          {types.map(c => (
            <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
