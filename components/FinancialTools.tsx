'use client';
import { useEffect, useMemo, useState } from 'react';
import { Transaction } from '@/lib/types';
import { userStorageKey } from '@/lib/auth';
import { scheduleCloudSync } from '@/lib/supabase/sync';
import { fmt } from '@/lib/insights';
import { getCategoryById } from '@/lib/categories';
import WalletBar from './WalletBar';
import SubscriptionsApp from './SubscriptionsApp';

interface Commitment {
  id: string;
  kind: 'subscription' | 'emi';
  name: string;
  amount: number;
  nextDue?: string;
}

interface Props {
  transactions: Transaction[];
  budget: number;
  expense: number;
  onSetBudget: (val: number) => void;
  onRefresh: () => void;
  walletFilter: string | null;
  onWalletFilter: (id: string) => void;
  voiceEnabled?: boolean;
  onRequestVoice?: () => void;
  voiceSubDrafts?: { name: string; amount: number }[];
  onVoiceSubDraftsConsumed?: () => void;
}

function loadCommitments(): Commitment[] {
  try {
    return JSON.parse(localStorage.getItem(userStorageKey('money_buddy_commitments')) ?? '[]');
  } catch {
    return [];
  }
}

function saveCommitments(list: Commitment[]) {
  localStorage.setItem(userStorageKey('money_buddy_commitments'), JSON.stringify(list));
  scheduleCloudSync();
}

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

export default function FinancialTools({
  transactions, budget, expense, onSetBudget, onRefresh, walletFilter, onWalletFilter,
  voiceEnabled, onRequestVoice, voiceSubDrafts, onVoiceSubDraftsConsumed,
}: Props) {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [showAdd, setShowAdd] = useState<'emi' | null>(null);
  const [showSubs, setShowSubs] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [calc, setCalc] = useState<'fd' | 'emi' | 'tax' | null>(null);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [showBudget, setShowBudget] = useState(false);

  // FD/RD
  const [principal, setPrincipal] = useState('100000');
  const [rate, setRate] = useState('7');
  const [years, setYears] = useState('3');
  // EMI
  const [loan, setLoan] = useState('500000');
  const [emiRate, setEmiRate] = useState('9');
  const [emiMonths, setEmiMonths] = useState('36');
  // Tax rough
  const [salary, setSalary] = useState('800000');

  useEffect(() => { setCommitments(loadCommitments()); }, []);

  const left = budget > 0 ? Math.max(0, budget - expense) : 0;
  const pct = budget > 0 ? Math.min(1, expense / budget) : 0;
  const emis = commitments.filter(c => c.kind === 'emi');

  // Auto-open when voice drafts arrive
  useEffect(() => {
    if (voiceSubDrafts?.length) setShowSubs(true);
  }, [voiceSubDrafts]);

  const fdMaturity = useMemo(() => {
    const p = Number(principal) || 0;
    const r = (Number(rate) || 0) / 100;
    const t = Number(years) || 0;
    return Math.round(p * Math.pow(1 + r, t));
  }, [principal, rate, years]);

  const emiValue = useMemo(() => {
    const p = Number(loan) || 0;
    const monthlyR = (Number(emiRate) || 0) / 1200;
    const n = Number(emiMonths) || 1;
    if (monthlyR === 0) return Math.round(p / n);
    return Math.round((p * monthlyR * Math.pow(1 + monthlyR, n)) / (Math.pow(1 + monthlyR, n) - 1));
  }, [loan, emiRate, emiMonths]);

  const taxEst = useMemo(() => {
    const income = Number(salary) || 0;
    // Very rough new-regime style slabs for illustration
    let tax = 0;
    if (income > 1500000) tax += (income - 1500000) * 0.3;
    if (income > 1200000) tax += Math.min(income, 1500000) - 1200000 > 0 ? (Math.min(income, 1500000) - 1200000) * 0.2 : 0;
    if (income > 900000) tax += Math.min(income, 1200000) - 900000 > 0 ? (Math.min(income, 1200000) - 900000) * 0.15 : 0;
    if (income > 600000) tax += Math.min(income, 900000) - 600000 > 0 ? (Math.min(income, 900000) - 600000) * 0.1 : 0;
    if (income > 300000) tax += Math.min(income, 600000) - 300000 > 0 ? (Math.min(income, 600000) - 300000) * 0.05 : 0;
    return Math.round(tax);
  }, [salary]);

  function addCommitment(kind: 'subscription' | 'emi') {
    const n = name.trim();
    const a = Number(amount);
    if (!n || !(a > 0)) return;
    const next = [...commitments, { id: crypto.randomUUID(), kind, name: n, amount: a }];
    setCommitments(next);
    saveCommitments(next);
    setName('');
    setAmount('');
    setShowAdd(null);
  }

  function removeCommitment(id: string) {
    const next = commitments.filter(c => c.id !== id);
    setCommitments(next);
    saveCommitments(next);
  }

  function saveBudget() {
    const val = Number(budgetDraft);
    onSetBudget(val > 0 ? val : 0);
    if (val > 0) localStorage.setItem(userStorageKey('money_buddy_budget'), String(val));
    else localStorage.removeItem(userStorageKey('money_buddy_budget'));
    scheduleCloudSync();
    setShowBudget(false);
  }

  return (
    <div className="flex flex-col gap-5">
      {showSubs && (
        <SubscriptionsApp
          onClose={() => setShowSubs(false)}
          voiceEnabled={voiceEnabled}
          onRequestVoice={onRequestVoice}
          voiceDrafts={voiceSubDrafts}
          onVoiceDraftsConsumed={onVoiceSubDraftsConsumed}
        />
      )}

      <h1 className="px-1 text-[28px] font-black text-white">Financial Tools</h1>

      <div className="rounded-[16px] bg-[#1c1c1e] border border-white/8 px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="font-semibold text-white">Monthly budget</span>
          <button type="button" onClick={() => { setBudgetDraft(budget > 0 ? String(budget) : ''); setShowBudget(v => !v); }}
            className="text-sm font-bold text-emerald-400 flex items-center gap-1">
            {budget > 0 ? `${fmt(left)} left` : 'Set budget'} ✎
          </button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct * 100}%` }} />
        </div>
        {showBudget && (
          <div className="mt-3 flex gap-2">
            <input value={budgetDraft} onChange={e => setBudgetDraft(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="numeric" placeholder="Monthly limit"
              className="clay flex-1 px-3 py-2.5 font-bold outline-none" />
            <button type="button" onClick={saveBudget} className="clay-btn bg-violet-500 text-white font-black px-4 rounded-[12px]">Save</button>
          </div>
        )}
      </div>

      <WalletBar transactions={transactions} selectedWallet={walletFilter} onSelectWallet={onWalletFilter} onChange={onRefresh} />

      <section>
        <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">Commitments</p>
        <div className="rounded-[16px] bg-[#1c1c1e] border border-white/8 divide-y divide-white/8 overflow-hidden">
          <button type="button" onClick={() => setShowSubs(true)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left min-h-[52px]">
            <span className="text-lg">⏱</span>
            <span className="flex-1 font-semibold text-white">Subscriptions</span>
            <span className="text-sm text-zinc-500">Track & renew ›</span>
          </button>
          <button type="button" onClick={() => setShowAdd(showAdd === 'emi' ? null : 'emi')}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left min-h-[52px]">
            <span className="text-lg">↻</span>
            <span className="flex-1 font-semibold text-white">EMIs</span>
            <span className="text-sm text-zinc-500">{emis.length ? `${emis.length}` : 'None yet'} ›</span>
          </button>
          {showAdd === 'emi' && (
            <div className="px-4 py-3 flex flex-col gap-2 bg-black/20">
              {emis.map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-200">{s.name} · {fmt(s.amount)}</span>
                  <button type="button" onClick={() => removeCommitment(s.id)} className="text-rose-400 font-bold">✕</button>
                </div>
              ))}
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Home loan"
                className="clay px-3 py-2.5 font-bold outline-none" />
              <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="EMI amount"
                inputMode="numeric" className="clay px-3 py-2.5 font-bold outline-none" />
              <button type="button" onClick={() => addCommitment('emi')}
                className="clay-btn bg-emerald-500 text-white font-black py-2.5 rounded-[12px]">+ Add EMI</button>
            </div>
          )}
        </div>
      </section>

      <section>
        <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">Calculators</p>
        <div className="rounded-[16px] bg-[#1c1c1e] border border-white/8 divide-y divide-white/8 overflow-hidden">
          {([
            { id: 'fd' as const, label: 'FD / RD calculator', icon: '📊' },
            { id: 'tax' as const, label: 'Tax estimator', icon: '📄' },
            { id: 'emi' as const, label: 'EMI calculator', icon: '🏦' },
          ]).map(row => (
            <div key={row.id}>
              <button type="button" onClick={() => setCalc(c => c === row.id ? null : row.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left min-h-[52px]">
                <span>{row.icon}</span>
                <span className="flex-1 font-semibold text-white">{row.label}</span>
                <span className="text-zinc-500">›</span>
              </button>
              {calc === row.id && row.id === 'fd' && (
                <div className="px-4 pb-4 flex flex-col gap-2">
                  <label className="text-xs text-zinc-500">Principal ₹</label>
                  <input value={principal} onChange={e => setPrincipal(e.target.value.replace(/[^\d.]/g, ''))} className="clay px-3 py-2.5 font-bold outline-none" />
                  <label className="text-xs text-zinc-500">Rate % p.a.</label>
                  <input value={rate} onChange={e => setRate(e.target.value.replace(/[^\d.]/g, ''))} className="clay px-3 py-2.5 font-bold outline-none" />
                  <label className="text-xs text-zinc-500">Years</label>
                  <input value={years} onChange={e => setYears(e.target.value.replace(/[^\d.]/g, ''))} className="clay px-3 py-2.5 font-bold outline-none" />
                  <p className="text-emerald-400 font-black text-lg mt-1">Maturity ≈ {fmt(fdMaturity)}</p>
                </div>
              )}
              {calc === row.id && row.id === 'emi' && (
                <div className="px-4 pb-4 flex flex-col gap-2">
                  <label className="text-xs text-zinc-500">Loan ₹</label>
                  <input value={loan} onChange={e => setLoan(e.target.value.replace(/[^\d.]/g, ''))} className="clay px-3 py-2.5 font-bold outline-none" />
                  <label className="text-xs text-zinc-500">Interest % p.a.</label>
                  <input value={emiRate} onChange={e => setEmiRate(e.target.value.replace(/[^\d.]/g, ''))} className="clay px-3 py-2.5 font-bold outline-none" />
                  <label className="text-xs text-zinc-500">Tenure (months)</label>
                  <input value={emiMonths} onChange={e => setEmiMonths(e.target.value.replace(/[^\d.]/g, ''))} className="clay px-3 py-2.5 font-bold outline-none" />
                  <p className="text-emerald-400 font-black text-lg mt-1">EMI ≈ {fmt(emiValue)}</p>
                </div>
              )}
              {calc === row.id && row.id === 'tax' && (
                <div className="px-4 pb-4 flex flex-col gap-2">
                  <label className="text-xs text-zinc-500">Annual income ₹</label>
                  <input value={salary} onChange={e => setSalary(e.target.value.replace(/[^\d.]/g, ''))} className="clay px-3 py-2.5 font-bold outline-none" />
                  <p className="text-amber-400 font-black text-lg mt-1">Rough tax ≈ {fmt(taxEst)}</p>
                  <p className="text-[11px] text-zinc-500">Illustrative new-regime style estimate — not tax advice.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">Data</p>
        <button type="button" onClick={() => exportCSV(transactions)} disabled={transactions.length === 0}
          className="flex w-full items-center gap-3 rounded-[16px] bg-[#1c1c1e] border border-white/8 px-4 py-3.5 text-left min-h-[52px] disabled:opacity-40">
          <span className="text-lg">📥</span>
          <span className="flex-1 font-semibold text-white">Export CSV</span>
          <span className="text-zinc-500">›</span>
        </button>
      </section>
    </div>
  );
}
