'use client';
import { useState } from 'react';
import { Transaction } from '@/lib/types';
import { userStorageKey } from '@/lib/auth';
import { scheduleCloudSync } from '@/lib/supabase/sync';
import RecurringManager from './RecurringManager';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN')}`; }

import { getCategories, getCategoryById } from '@/lib/categories';

function exportCSV(transactions: Transaction[]) {
  const headers = ['Date', 'Type', 'Amount', 'Description', 'Wallet', 'Category'];
  const rows = transactions
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(t => {
      const cat = t.categoryId ? getCategoryById(t.categoryId)?.name ?? '' : '';
      return [t.date, t.type, t.amount, `"${(t.description ?? '').replace(/"/g, '""')}"`, t.walletId ?? t.paymentMode, cat];
    });
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `money-buddy-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

interface Props {
  transactions: Transaction[];
  budget: number;
  onSetBudget: (val: number) => void;
  onRefresh: () => void;
  recurringRefresh?: number;
}

export default function BottomTools({ transactions, budget, onSetBudget, onRefresh, recurringRefresh = 0 }: Props) {
  const [showBudget, setShowBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');

  function saveBudget() {
    const val = Number(budgetDraft);
    onSetBudget(val > 0 ? val : 0);
    if (val > 0) localStorage.setItem(userStorageKey('money_buddy_budget'), String(val));
    else localStorage.removeItem(userStorageKey('money_buddy_budget'));
    scheduleCloudSync();
    setShowBudget(false);
    setBudgetDraft('');
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Recurring rules */}
      <RecurringManager onRefresh={onRefresh} refreshKey={recurringRefresh} />

      {/* Export CSV + Set Budget */}
      <div className="flex gap-2">
        <button
          onClick={() => exportCSV(transactions)}
          disabled={transactions.length === 0}
          className="clay-btn flex-1 py-3 rounded-[14px] font-bold text-sm text-stone-600 bg-white/70 border border-stone-200 disabled:opacity-40">
          📥 Export CSV
        </button>
        <button
          onClick={() => { setBudgetDraft(budget > 0 ? String(budget) : ''); setShowBudget(v => !v); }}
          className={`clay-btn flex-1 py-3 rounded-[14px] font-bold text-sm border transition-all ${
            budget > 0 ? 'clay-amber text-amber-900 border-amber-200' : 'text-stone-600 bg-white/70 border-stone-200'
          }`}>
          🎯 {budget > 0 ? `Budget: ${fmt(budget)}` : 'Set Budget'}
        </button>
      </div>

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
          <button onClick={saveBudget}
            className="clay-btn bg-violet-500 text-white font-black text-xs px-3 py-1.5 rounded-[10px] shrink-0">
            Save
          </button>
        </div>
      )}
    </div>
  );
}
