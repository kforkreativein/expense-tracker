'use client';
import { useMemo, useState } from 'react';
import { Transaction, Category, CategoryTransfer } from '@/lib/types';
import { buildAiInsights } from '@/lib/aiInsights';
import { fmt } from '@/lib/insights';
import InsightsChart from './InsightsChart';
import WeeklySummary from './WeeklySummary';
import CategoryBreakdown from './CategoryBreakdown';
import AffordCheckCard from './AffordCheckCard';
import YearEndReport from './YearEndReport';
import BusinessProfitCard from './BusinessProfitCard';
import WalletBar from './WalletBar';

interface Props {
  transactions: Transaction[];
  monthTransactions: Transaction[];
  transfers: CategoryTransfer[];
  categories: Category[];
  budget: number;
  income: number;
  year: number;
  month: number;
  walletFilter: string | null;
  onWalletFilter: (id: string) => void;
  onRefresh: () => void;
}

export default function InsightsTab({
  transactions, monthTransactions, transfers, categories,
  budget, income, year, month, walletFilter, onWalletFilter, onRefresh,
}: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const cards = useMemo(
    () => buildAiInsights(monthTransactions, budget, income, year, month),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthTransactions, budget, income, year, month, refreshKey],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[28px] font-black text-white">Insights</h1>
        <button
          type="button"
          onClick={() => setRefreshKey(k => k + 1)}
          className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 min-h-[44px]"
        >
          ↻ Refresh
        </button>
      </div>

      <WalletBar
        transactions={transactions}
        selectedWallet={walletFilter}
        onSelectWallet={onWalletFilter}
        onChange={onRefresh}
      />

      <div className="rounded-[16px] border border-white/8 bg-[#1c1c1e] p-4 text-sm text-zinc-400">
        <p className="font-black text-zinc-200 mb-1">This month at a glance</p>
        <p>Income {fmt(income)} · Budget {budget > 0 ? fmt(budget) : 'not set'}</p>
      </div>

      <section className="flex flex-col gap-3">
        <p className="px-1 text-[11px] font-black uppercase tracking-[0.14em] text-amber-400/90">
          ✨ AI insights
        </p>
        {monthTransactions.filter(t => t.type === 'expense').length === 0 ? (
          <p className="rounded-[16px] border border-white/10 px-4 py-3 text-center text-sm font-semibold text-zinc-400">
            Add transactions to get AI insights
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
            {cards.map(card => (
              <div
                key={card.id}
                className="snap-start shrink-0 w-[min(86vw,20rem)] rounded-[18px] border border-amber-500/25 bg-[#1a1510] p-4 flex flex-col gap-3"
              >
                <p className="text-[15px] font-semibold leading-relaxed text-zinc-100">{card.body}</p>
                {card.highlight && (
                  <div className="rounded-[12px] bg-amber-500/15 px-3 py-2.5 text-sm font-bold text-amber-100">
                    {card.highlight}
                  </div>
                )}
                {card.action && (
                  <p className="text-xs font-bold text-amber-300/90">{card.action}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <InsightsChart transactions={transactions} />
      <WeeklySummary transactions={transactions} />
      <CategoryBreakdown transactions={transactions} transfers={transfers} categories={categories} />
      <AffordCheckCard categories={categories} transactions={transactions} transfers={transfers} />
      <BusinessProfitCard categories={categories} transactions={transactions} transfers={transfers} />
      <YearEndReport transactions={transactions} transfers={transfers} categories={categories} />
    </div>
  );
}
