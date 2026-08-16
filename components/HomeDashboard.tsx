'use client';
import { useState } from 'react';
import { Category } from '@/lib/types';
import { fmt } from '@/lib/insights';

const LEGEND: { label: string; color: string }[] = [
  { label: 'Food', color: '#ef4444' },
  { label: 'Shopping', color: '#3b82f6' },
  { label: 'Travel', color: '#7dd3fc' },
  { label: 'Grocery', color: '#22c55e' },
  { label: 'Rent', color: '#fb923c' },
  { label: 'Investments', color: '#eab308' },
  { label: 'Health', color: '#a855f7' },
  { label: 'EMI/Bill', color: '#f472b6' },
  { label: 'Subscriptions', color: '#6366f1' },
  { label: 'Others', color: '#9ca3af' },
];

interface Props {
  expense: number;
  income: number;
  budget: number;
  month: Date;
  onMonthChange: (delta: number) => void;
  onSetBudget: () => void;
  activeCategory?: Category | null;
  incomeNotSet?: boolean;
}

export default function HomeDashboard({
  expense,
  income,
  budget,
  month,
  onMonthChange,
  onSetBudget,
  activeCategory,
  incomeNotSet,
}: Props) {
  const [show, setShow] = useState(false);
  const monthLabel = month.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  return (
    <div className="flex flex-col gap-5 px-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {incomeNotSet && income === 0 && (
            <span className="mb-2 inline-flex rounded-full bg-[#dc2626] px-2.5 py-1 text-[10px] font-black tracking-wide text-white">
              INCOME NOT SET
            </span>
          )}
          <h1 className="text-[22px] font-black leading-tight text-white">Your Monthly Expenses</h1>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-[#2c2c2e] px-3 py-1.5 text-sm font-semibold text-white">
          <button type="button" aria-label="Previous month" onClick={() => onMonthChange(-1)} className="px-1 text-zinc-400">‹</button>
          <span>{monthLabel}</span>
          <button type="button" aria-label="Next month" onClick={() => onMonthChange(1)} className="px-1 text-zinc-400">›</button>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <p className="text-[44px] font-black leading-none tracking-tight text-white">
          {show ? (
            budget > 0 ? (
              <>
                {fmt(expense)}
                <span className="text-[28px] font-bold text-zinc-400"> / {fmt(budget)}</span>
              </>
            ) : (
              fmt(expense)
            )
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
          {show ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {activeCategory && (
        <p className="text-sm font-semibold text-zinc-400">
          Showing {activeCategory.emoji} {activeCategory.name}
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        {LEGEND.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
            <span className="truncate text-[13px] font-medium text-zinc-300">{item.label}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onSetBudget}
        className="flex min-h-[48px] items-center gap-3 rounded-[16px] border border-white/12 bg-transparent px-4 text-left"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-400">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="5" y="4" width="14" height="16" rx="2" />
            <path d="M9 8h6M9 12h6M9 16h3" strokeLinecap="round" />
          </svg>
        </span>
        <span className="flex-1 text-[15px] font-semibold text-white">
          {budget > 0 ? `Monthly budget ${fmt(budget)}` : 'Set a monthly budget'}
        </span>
        <span className="text-zinc-500">›</span>
      </button>
    </div>
  );
}
