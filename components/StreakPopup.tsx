'use client';
import { useEffect } from 'react';

interface Props {
  previousStreak: number;
  streak: number;
  onDone: () => void;
}

export default function StreakPopup({ previousStreak, streak, onDone }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-pop-in"
      style={{ background: 'var(--overlay-bg)' }}
      onClick={onDone}
      role="dialog"
      aria-live="polite">
      <div
        className="clay clay-purple px-10 py-8 text-center w-full max-w-[260px] shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <p className="text-5xl leading-none" aria-hidden="true">🔥</p>
        <p className="text-3xl font-black text-violet-950 mt-4 tracking-tight">
          {previousStreak} → {streak}
        </p>
        <p className="text-sm font-black text-violet-800 mt-1 uppercase tracking-wide">
          day streak
        </p>
        {streak === 1 && (
          <p className="text-xs font-semibold text-violet-700 mt-3">Welcome back — keep it going!</p>
        )}
      </div>
    </div>
  );
}
