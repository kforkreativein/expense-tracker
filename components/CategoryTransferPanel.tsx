'use client';
import { useState, useMemo } from 'react';
import { Wallet } from '@/lib/types';
import { executeWalletTransfer } from '@/lib/transfers';
import { getWallets } from '@/lib/wallets';

interface Props {
  onTransfer: () => void;
}

export default function CategoryTransferPanel({ onTransfer }: Props) {
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const wallets = getWallets() as Wallet[];

  const preview = useMemo(() => {
    if (!fromId || !toId || fromId === toId) return null;
    const fromW = wallets.find(w => w.id === fromId);
    const toW = wallets.find(w => w.id === toId);
    return {
      type: 'ok' as const,
      text: `Money will move from ${fromW?.name ?? 'this wallet'} to ${toW?.name ?? 'this wallet'}.`,
    };
  }, [fromId, toId, wallets]);

  if (wallets.length < 2) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    if (!fromId || !toId) { setError('Choose both wallets'); return; }
    if (fromId === toId) { setError('Choose two different wallets'); return; }

    try {
      const result = executeWalletTransfer({
        amount: amt,
        fromWalletId: fromId,
        toWalletId: toId,
        note: note.trim() || undefined,
        date: new Date().toISOString().slice(0, 10),
      });
      setSuccess(`Done! ₹${amt.toLocaleString('en-IN')} moved ${result.fromWalletName} → ${result.toWalletName}`);
      setAmount('');
      setNote('');
      onTransfer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not transfer money');
    }
  }

  return (
    <div className="clay flex flex-col">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="clay-btn flex items-center justify-between px-4 py-3 font-bold text-sm text-stone-600">
        <span>🔁 Transfer Between Wallets</span>
        <span className="text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="px-3 pb-3 flex flex-col gap-2">
          <p className="text-xs font-semibold text-stone-500">
            Move money directly between your bank accounts, cash, and wallets. Categories are not used for transfers.
          </p>
          <div className="flex gap-2 flex-wrap">
            <select value={fromId} onChange={e => setFromId(e.target.value)}
              className="clay flex-1 min-w-[120px] px-2 py-2.5 font-bold text-stone-700 bg-transparent outline-none">
              <option value="">From wallet</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}
            </select>
            <span className="self-center text-stone-400">→</span>
            <select value={toId} onChange={e => setToId(e.target.value)}
              className="clay flex-1 min-w-[120px] px-2 py-2.5 font-bold text-stone-700 bg-transparent outline-none">
              <option value="">To wallet</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}
            </select>
          </div>
          {preview && (
            <p className={`text-xs font-bold px-2 py-1.5 rounded-[10px] ${
              'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              💳 {preview.text}
            </p>
          )}
          <div className="flex gap-2">
            <span className="text-stone-500 font-black self-center">₹</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="Amount"
              className="clay flex-1 px-3 py-2.5 bg-transparent outline-none font-bold text-stone-700"
            />
          </div>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="clay px-3 py-2.5 font-semibold text-stone-700 bg-transparent outline-none w-full"
          />
          {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
          {success && <p className="text-xs font-bold text-emerald-600 leading-relaxed">{success}</p>}
          <button type="submit" className="clay-btn py-2.5 bg-violet-500 text-white font-black text-sm rounded-[12px]">Transfer</button>
        </form>
      )}
    </div>
  );
}
