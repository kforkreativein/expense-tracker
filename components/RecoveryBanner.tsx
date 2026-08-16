'use client';
import { useMemo, useState } from 'react';
import { findLocalBackups, restoreLocalBackup, LocalBackup } from '@/lib/recovery';
import { pushToCloud } from '@/lib/supabase/sync';
import { wasReset } from '@/lib/reset';

interface Props {
  currentCount: number;
  onRestored: () => void;
}

export default function RecoveryBanner({ currentCount, onRestored }: Props) {
  const backups = useMemo(() => findLocalBackups(), [currentCount]);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const best = backups.find(b => b.transactionCount > currentCount);
  // After a deliberate reset, offering the cleared entries back would be alarming
  if (!best || done || wasReset()) return null;

  async function handleRestore(backup: LocalBackup) {
    setBusy(backup.id);
    try {
      restoreLocalBackup(backup.id);
      try {
        await pushToCloud();
      } catch (err) {
        console.error('cloud push after restore failed', err);
      }
      setDone(true);
      onRestored();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="clay clay-amber p-4 flex flex-col gap-3 animate-slide-up">
      <p className="text-sm font-black text-amber-950">
        Found {best.transactionCount} saved entries on this device
      </p>
      <p className="text-xs font-semibold text-amber-900 leading-relaxed">
        Your account shows {currentCount} entries. Tap restore to bring back the local backup
        ({best.label.toLowerCase()}).
      </p>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => handleRestore(best)}
        className="clay-btn w-full py-3 bg-amber-500 text-white font-black rounded-[12px] min-h-[44px] disabled:opacity-50">
        {busy ? 'Restoring…' : `Restore ${best.transactionCount} entries`}
      </button>
    </div>
  );
}
