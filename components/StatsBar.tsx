'use client';
import { useState } from 'react';
import { Transaction, Category, CategoryTransfer } from '@/lib/types';
import { computeCategoryTotals, fmt, isCurrentMonth } from '@/lib/insights';
import { sumRealExpense, sumRealIncome } from '@/lib/transfers';

function currentMonthLabel() {
  return new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function EyeBtn({ show, onClick }: { show: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="clay-btn opacity-60 hover:opacity-100 transition-opacity leading-none"
      aria-label={show ? 'Hide amount' : 'Show amount'}>
      {show ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

interface Props {
  transactions: Transaction[];
  budget: number;
  categories: Category[];
  categoryFilter: string | null;
  transfers: CategoryTransfer[];
}

export default function StatsBar({ transactions, budget, categories, categoryFilter, transfers }: Props) {
  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showInvestment, setShowInvestment] = useState(false);
  const [showNet, setShowNet] = useState(false);

  const monthly = transactions.filter(t => isCurrentMonth(t.date));
  const monthTransfers = transfers.filter(t => isCurrentMonth(t.date));

  const income = sumRealIncome(monthly, monthTransfers);
  const expense = sumRealExpense(monthly, monthTransfers);
  const investment = monthly.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0);
  const net = income - expense;

  const activeCategory = categoryFilter && categoryFilter !== '__none'
    ? categories.find(c => c.id === categoryFilter)
    : null;

  const catTotals = categoryFilter
    ? computeCategoryTotals(
        monthly,
        transfers.filter(t => isCurrentMonth(t.date)),
        categoryFilter === '__none' ? null : categoryFilter,
        false,
      )
    : null;

  const categoryBudget = activeCategory?.budget ?? 0;
  const categoryPct = categoryBudget > 0 && catTotals ? Math.min(catTotals.expense / categoryBudget, 1) : 0;
  const categoryOver = categoryBudget > 0 && catTotals && catTotals.expense > categoryBudget;

  const budgetPct = budget > 0 ? Math.min(expense / budget, 1) : 0;
  const overBudget = budget > 0 && expense > budget;

  const displayIncome = catTotals ? catTotals.income : income;
  const displayExpense = catTotals ? catTotals.expense : expense;
  const displayNet = catTotals ? catTotals.net : net;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-black text-stone-400 uppercase tracking-wider px-1">
        📅 {currentMonthLabel()}
        {activeCategory && <span className="text-violet-600 normal-case"> · {activeCategory.emoji} {activeCategory.name}</span>}
        {categoryFilter === '__none' && <span className="text-stone-500 normal-case"> · Uncategorized</span>}
      </p>

      {/* Row 1: Income + Expense */}
      <div className="grid grid-cols-2 gap-3">
        <div className="clay-green clay p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Income 💚</span>
            <EyeBtn show={showIncome} onClick={() => setShowIncome(v => !v)} />
          </div>
          <span className="text-xl font-black text-emerald-900 tracking-tight">
            {showIncome ? fmt(displayIncome) : '₹ ·····'}
          </span>
        </div>

        <div className="clay-red clay p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-900 uppercase tracking-wide">
              Expense ❤️{!categoryFilter && overBudget ? ' 🚨' : categoryOver ? ' 🚨' : ''}
            </span>
            <EyeBtn show={showExpense} onClick={() => setShowExpense(v => !v)} />
          </div>
          <span className="text-xl font-black text-red-900 tracking-tight">
            {showExpense ? fmt(displayExpense) : '₹ ·····'}
          </span>
        </div>
      </div>

      {/* Category budget bar */}
      {activeCategory && categoryBudget > 0 && catTotals && (
        <div className="px-1">
          <div className="h-1.5 rounded-full bg-violet-200/60 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${categoryOver ? 'bg-violet-700' : 'bg-violet-400'}`} style={{ width: `${categoryPct * 100}%` }} />
          </div>
          <p className="text-[10px] font-bold text-violet-800/70 mt-0.5">
            {categoryOver
              ? `${activeCategory.emoji} ${activeCategory.name} over by ${fmt(catTotals.expense - categoryBudget)}`
              : `${fmt(categoryBudget - catTotals.expense)} left of ${fmt(categoryBudget)} ${activeCategory.name} budget`}
          </p>
        </div>
      )}

      {/* Total expense budget bar */}
      {!categoryFilter && budget > 0 && (
        <div className="px-1">
          <div className="budget-meter__track" role="progressbar" aria-valuenow={Math.round(budgetPct * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`budget-meter__fill ${overBudget ? 'is-over' : ''}`} style={{ width: `${budgetPct * 100}%` }} />
          </div>
          <p className="text-[10px] font-bold text-red-800/70 mt-0.5">
            {overBudget ? `Over total budget by ${fmt(expense - budget)}` : `${fmt(budget - expense)} left of ${fmt(budget)} total expense budget`}
          </p>
        </div>
      )}

      {/* Row 2: Investment + Net Income side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="clay clay-blue p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">Invest 💼</span>
            <EyeBtn show={showInvestment} onClick={() => setShowInvestment(v => !v)} />
          </div>
          <span className="text-xl font-black text-blue-900 tracking-tight">
            {showInvestment ? fmt(investment) : '₹ ·····'}
          </span>
        </div>

        <div className="clay clay-amber p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
              {categoryFilter ? 'Cat. Net' : 'Net Income'} 🟠
            </span>
            <EyeBtn show={showNet} onClick={() => setShowNet(v => !v)} />
          </div>
          <span className={`text-xl font-black tracking-tight ${displayNet >= 0 ? 'text-amber-800' : 'text-red-700'}`}>
            {showNet ? `${displayNet >= 0 ? '+' : ''}${fmt(displayNet)}` : '₹ ·····'}
          </span>
        </div>
      </div>
    </div>
  );
}
