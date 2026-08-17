'use client';
import { useState } from 'react';
import { parseQuickText, VoiceRequestError } from '@/lib/voice/client';
import { VoiceResult } from '@/lib/voice/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onResult: (result: VoiceResult) => void;
}

/** Type a short note; AI turns it into a confirmable entry (AboutMoney-style). */
export default function TextQuickEntry({ open, onClose, onResult }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await parseQuickText(trimmed);
      setText('');
      onClose();
      onResult(result);
    } catch (err) {
      setError(err instanceof VoiceRequestError ? err.message : 'Could not understand that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-[22px] border border-white/10 bg-[#1c1c1e] p-4 shadow-2xl animate-pop-in"
        onClick={e => e.stopPropagation()}
      >
        <p className="mb-3 text-center text-xs italic text-zinc-500">
          Type naturally — AI fills amount, type, and notes
        </p>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          placeholder="e.g. 50₹ income interest"
          className="w-full resize-none rounded-[14px] border border-white/10 bg-black/40 px-3 py-3 text-[16px] font-semibold text-white outline-none placeholder:text-zinc-600"
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
          }}
        />
        {error && <p className="mt-2 text-center text-xs font-semibold text-rose-400">{error}</p>}
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-full px-4 py-2.5 text-sm font-bold text-zinc-400 min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={() => void submit()}
            className="rounded-full bg-[#22c55e] px-5 py-2.5 text-sm font-black text-white min-h-[44px] disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
