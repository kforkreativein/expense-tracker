'use client';
import { useMemo, useState } from 'react';
import { Transaction } from '@/lib/types';
import { getSpendCategories } from '@/lib/spendCategories';
import { fmt } from '@/lib/insights';
import MonthPickerModal from './MonthPickerModal';

export const PIE_COLORS: Record<string, string> = {
  Food: '#ef4444',
  Shopping: '#3b82f6',
  Travel: '#7dd3fc',
  Transport: '#7dd3fc',
  Grocery: '#22c55e',
  Groceries: '#22c55e',
  Rent: '#fb923c',
  Home: '#fb923c',
  Investments: '#eab308',
  Health: '#a855f7',
  'EMI/Bill': '#f472b6',
  Bills: '#f472b6',
  Subscriptions: '#6366f1',
  Fun: '#6366f1',
  Others: '#9ca3af',
  Other: '#9ca3af',
  Gifts: '#9ca3af',
};

const LEGEND_ORDER = [
  'Food', 'Shopping', 'Travel', 'Grocery', 'Rent',
  'Investments', 'Health', 'EMI/Bill', 'Subscriptions', 'Others',
];

interface Slice {
  label: string;
  amount: number;
  color: string;
}

interface Props {
  expense: number;
  income: number;
  budget: number;
  month: Date;
  onMonthSelect: (year: number, month: number) => void;
  onSetBudget: () => void;
  expenses: Transaction[];
  prevMonthExpense?: number;
}

function buildSlices(expenses: Transaction[]): Slice[] {
  const cats = getSpendCategories();
  const byId: Record<string, number> = {};
  let other = 0;
  for (const t of expenses) {
    if (t.type !== 'expense') continue;
    if (t.spendCategoryId) {
      byId[t.spendCategoryId] = (byId[t.spendCategoryId] ?? 0) + t.amount;
    } else {
      other += t.amount;
    }
  }
  const slices: Slice[] = cats
    .map(c => ({
      label: c.name,
      amount: byId[c.id] ?? 0,
      color: PIE_COLORS[c.name] ?? PIE_COLORS.Others,
    }))
    .filter(s => s.amount > 0);

  if (other > 0) slices.push({ label: 'Others', amount: other, color: PIE_COLORS.Others });

  // Always show legend labels even with zero — match AboutMoney layout
  return slices.length ? slices : [{ label: 'Others', amount: 0, color: PIE_COLORS.Others }];
}

function pieGradient(slices: Slice[], total: number): string {
  if (total <= 0) return 'conic-gradient(#3f3f46 0deg 360deg)';
  let acc = 0;
  const parts = slices.map(s => {
    const start = (acc / total) * 360;
    acc += s.amount;
    const end = (acc / total) * 360;
    return `${s.color} ${start}deg ${end}deg`;
  });
  return `conic-gradient(${parts.join(', ')})`;
}

export default function HomeDashboard({
  expense,
  income,
  budget,
  month,
  onMonthSelect,
  onSetBudget,
  expenses,
  prevMonthExpense = 0,
}: Props) {
  const [show, setShow] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const monthLabel = month.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  const slices = useMemo(() => buildSlices(expenses), [expenses]);
  const pieTotal = slices.reduce((s, x) => s + x.amount, 0) || expense;
  const left = budget > 0 ? Math.max(0, budget - expense) : 0;
  const pct = budget > 0 ? Math.min(1, expense / budget) : 0;
  const delta = expense - prevMonthExpense;

  const legend = LEGEND_ORDER.map(label => {
    const hit = slices.find(s => s.label === label || (label === 'Grocery' && s.label === 'Groceries')
      || (label === 'Travel' && s.label === 'Transport')
      || (label === 'Rent' && s.label === 'Home')
      || (label === 'EMI/Bill' && s.label === 'Bills')
      || (label === 'Subscriptions' && s.label === 'Fun')
      || (label === 'Others' && (s.label === 'Other' || s.label === 'Gifts')));
    return { label, color: PIE_COLORS[label] ?? '#9ca3af', amount: hit?.amount ?? 0 };
  });

  return (
    <div className="flex flex-col gap-4 px-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {income === 0 && (
            <span className="mb-2 inline-flex rounded-full bg-[#dc2626] px-2.5 py-1 text-[10px] font-black tracking-wide text-white">
              INCOME NOT SET
            </span>
          )}
          <h1 className="text-[22px] font-black leading-tight text-white">Your Monthly Expenses</h1>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-[#2c2c2e] px-3 py-1.5 text-sm font-semibold text-white"
        >
          {monthLabel}
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M8 10l4 4 4-4M8 6l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="flex items-end gap-3">
        <p className="text-[40px] font-black leading-none tracking-tight text-white">
          {show ? (
            <>
              {fmt(expense)}
              {budget > 0 && <span className="text-[24px] font-bold text-zinc-500"> / {fmt(budget)}</span>}
            </>
          ) : (
            '₹ ·····'
          )}
        </p>
        <button
          type="button"
          aria-label={show ? 'Hide amount' : 'Show amount'}
          onClick={() => setShow(v => !v)}
          className="mb-1 text-zinc-500"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            {show ? (
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>

      {delta !== 0 && expense > 0 && (
        <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${
          delta > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
        }`}>
          Expenses {delta > 0 ? 'up' : 'down'} by {delta > 0 ? '+' : ''}{fmt(delta)}
        </span>
      )}

      <div className="flex items-center gap-4">
        <div
          className="h-[110px] w-[110px] shrink-0 rounded-full"
          style={{ background: pieGradient(slices.filter(s => s.amount > 0), pieTotal || 1) }}
          aria-hidden
        />
        <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1.5">
          {legend.map(item => (
            <div key={item.label} className="flex items-center gap-1.5 min-w-0">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
              <span className="truncate text-[12px] font-medium text-zinc-300">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onSetBudget}
        className="flex flex-col gap-2 rounded-[16px] border border-white/10 bg-[#1c1c1e] px-4 py-3 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-white">Monthly budget</span>
          <span className="flex items-center gap-1 text-sm font-bold text-emerald-400">
            {budget > 0 ? `${fmt(left)} left` : 'Set budget'}
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all ${pct > 0.9 ? 'bg-rose-500' : 'bg-emerald-500'}`}
            style={{ width: `${Math.max(pct * 100, budget > 0 ? 2 : 0)}%` }}
          />
        </div>
      </button>

      {pickerOpen && (
        <MonthPickerModal
          year={month.getFullYear()}
          month={month.getMonth()}
          onConfirm={(y, m) => { onMonthSelect(y, m); setPickerOpen(false); }}
          onCancel={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
