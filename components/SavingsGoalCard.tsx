'use client';
import { useState, useEffect } from 'react';
import { Transaction } from '@/lib/types';
import { getSavingsGoal, setSavingsGoal } from '@/lib/goals';
import { savingsProgress, fmt } from '@/lib/insights';

export default function SavingsGoalCard({ transactions, onChange }: {
  transactions: Transaction[];
  onChange?: () => void;
}) {
  const [targetDraft, setTargetDraft] = useState('');
  const [labelDraft, setLabelDraft] = useState('My Savings Goal');
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState(getSavingsGoal());

  const saved = savingsProgress(transactions);
  const target = goal?.target ?? 0;
  const pct = target > 0 ? Math.min(saved / target, 1) : 0;

  useEffect(() => {
    const g = getSavingsGoal();
    setGoal(g);
    if (g) {
      setTargetDraft(String(g.target));
      setLabelDraft(g.label);
    }
  }, [transactions]);

  function save() {
    const targetVal = Number(targetDraft);
    if (!targetVal || targetVal <= 0) {
      setSavingsGoal(null);
      setGoal(null);
      setEditing(false);
      onChange?.();
      return;
    }
    const g = { target: targetVal, label: labelDraft.trim() || 'My Savings Goal' };
    setSavingsGoal(g);
    setGoal(g);
    setEditing(false);
    onChange?.();
  }

  return (
    <div className="clay clay-purple p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-violet-900 uppercase tracking-wider">🎯 Savings Goal</h3>
        <button type="button" onClick={() => setEditing(v => !v)} className="clay-btn text-xs font-bold text-violet-700 px-2 py-1 rounded-[8px]">
          {editing ? 'Cancel' : goal ? 'Edit' : 'Set goal'}
        </button>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            value={labelDraft}
            onChange={e => setLabelDraft(e.target.value)}
            placeholder="Goal name"
            className="clay px-3 py-2.5 font-bold text-stone-700 bg-transparent outline-none w-full"
          />
          <div className="flex gap-2 items-center">
            <span className="font-black text-stone-500">₹</span>
            <input
              type="text"
              inputMode="numeric"
              value={targetDraft}
              onChange={e => setTargetDraft(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="Target amount"
              className="clay flex-1 px-3 py-2.5 bg-transparent outline-none font-bold text-stone-700"
            />
            <button type="button" onClick={save} className="clay-btn bg-violet-500 text-white font-black text-xs px-3 py-1.5 rounded-[8px]">Save</button>
          </div>
          <p className="text-[10px] text-violet-700/80 font-semibold">Progress counts your total investments 📈</p>
        </div>
      ) : goal ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <p className="text-sm font-black text-violet-900 truncate">{goal.label}</p>
            <p className="text-xs font-bold text-violet-800 whitespace-nowrap">
              {fmt(saved)} / {fmt(target)}
            </p>
          </div>
          <div className="h-2.5 rounded-full bg-violet-200/70 overflow-hidden">
            <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${pct * 100}%` }} />
          </div>
          <p className="text-[11px] font-bold text-violet-800">{Math.round(pct * 100)}% complete</p>
        </>
      ) : (
        <p className="text-sm font-semibold text-violet-700/80">Set a savings target — we&apos;ll track it from your investments.</p>
      )}
    </div>
  );
}
