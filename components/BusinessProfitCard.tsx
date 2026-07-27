'use client';
import { useState } from 'react';
import { Category, Transaction, CategoryTransfer } from '@/lib/types';
import { findCategoryByKeyword } from '@/lib/categories';
import { computeCategoryTotals, fmt, isCurrentMonth } from '@/lib/insights';

interface Props {
  categories: Category[];
  transactions: Transaction[];
  transfers: CategoryTransfer[];
}

export default function BusinessProfitCard({ categories, transactions, transfers }: Props) {
  const [showAmount, setShowAmount] = useState(false);
  const business = findCategoryByKeyword(categories, 'business');
  if (!business) return null;

  const monthly = transactions.filter(t => isCurrentMonth(t.date));
  const monthTransfers = transfers.filter(t => isCurrentMonth(t.date));
  const totals = computeCategoryTotals(monthly, monthTransfers, business.id, false);
  const profit = totals.income - totals.expense;

  return (
    <div className="clay clay-amber p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider">
          {business.emoji} Business Profit
        </h3>
        <button type="button" onClick={() => setShowAmount(v => !v)} className="clay-btn text-lg leading-none opacity-70">
          {showAmount ? '👁' : '🙈'}
        </button>
      </div>
      <p className={`text-2xl font-black ${profit >= 0 ? 'text-amber-900' : 'text-rose-600'}`}>
        {showAmount ? `${profit >= 0 ? '+' : ''}${fmt(profit)}` : '₹ ·····'}
      </p>
      <p className="business-profit-caption text-xs font-semibold">
        This month: income {showAmount ? fmt(totals.income) : '···'} − expense {showAmount ? fmt(totals.expense) : '···'} (investments excluded)
      </p>
    </div>
  );
}
