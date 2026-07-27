'use client';
import { useState } from 'react';
import { Transaction, Category, CategoryTransfer } from '@/lib/types';
import { ViewMode } from '@/lib/view';
import BusinessProfitCard from './BusinessProfitCard';
import AffordCheckCard from './AffordCheckCard';
import MonthlyCloseCard from './MonthlyCloseCard';
import WalletBar from './WalletBar';
import BottomTools from './BottomTools';
import InsightsChart from './InsightsChart';
import SavingsGoalCard from './SavingsGoalCard';
import DueReminders from './DueReminders';
import WeeklySummary from './WeeklySummary';
import CategoryBreakdown from './CategoryBreakdown';
import CategoryTransferPanel from './CategoryTransferPanel';
import TransferHistory from './TransferHistory';
import YearEndReport from './YearEndReport';

interface Props {
  transactions: Transaction[];
  viewTransactions: Transaction[];
  transfers: CategoryTransfer[];
  categories: Category[];
  viewMode: ViewMode;
  walletFilter: string | null;
  onWalletFilter: (id: string) => void;
  budget: number;
  onSetBudget: (val: number) => void;
  onRefresh: () => void;
  recurringRefresh: number;
  onTransfer: () => void;
  onTransferUndo: () => void;
}

export default function MoreSection(props: Props) {
  const [open, setOpen] = useState(false);
  const {
    transactions, viewTransactions, transfers, categories, viewMode,
    walletFilter, onWalletFilter, budget, onSetBudget, onRefresh, recurringRefresh,
    onTransfer, onTransferUndo,
  } = props;

  return (
    <div className="clay flex flex-col mt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="clay-btn flex items-center justify-between px-4 py-3.5 font-bold text-sm text-stone-600 min-h-[48px]">
        <span>📂 More — wallets, charts &amp; tools</span>
        <span className="text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-1 pb-3 flex flex-col gap-4">
          <BusinessProfitCard categories={categories} transactions={transactions} transfers={transfers} />
          <AffordCheckCard categories={categories} transactions={transactions} transfers={transfers} />
          <MonthlyCloseCard transactions={transactions} transfers={transfers} categories={categories} />
          <WalletBar transactions={transactions} selectedWallet={walletFilter} onSelectWallet={onWalletFilter} onChange={onRefresh} />
          <BottomTools
            transactions={viewTransactions}
            budget={budget}
            onSetBudget={onSetBudget}
            onRefresh={onRefresh}
            recurringRefresh={recurringRefresh}
          />
          <InsightsChart transactions={viewTransactions} />
          <SavingsGoalCard transactions={transactions} />
          <DueReminders />
          <WeeklySummary transactions={viewTransactions} />
          {viewMode === 'all' && (
            <CategoryBreakdown transactions={transactions} transfers={transfers} categories={categories} />
          )}
          <CategoryTransferPanel onTransfer={onTransfer} />
          <TransferHistory onUndo={onTransferUndo} />
          <YearEndReport transactions={transactions} transfers={transfers} categories={categories} />
        </div>
      )}
    </div>
  );
}
