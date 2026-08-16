'use client';
import { useState } from 'react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  year: number;
  month: number;
  onConfirm: (year: number, month: number) => void;
  onCancel: () => void;
}

export default function MonthPickerModal({ year, month, onConfirm, onCancel }: Props) {
  const [y, setY] = useState(year);
  const [m, setM] = useState(month);
  const now = new Date();
  const isFuture = (mi: number) => y > now.getFullYear() || (y === now.getFullYear() && mi > now.getMonth());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-[24px] bg-[#1c1c1e] p-5 animate-pop-in"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-4 text-center text-lg font-black text-white">Select Month</h2>
        <div className="rounded-[18px] bg-[#2c2c2e] p-4">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" aria-label="Previous year" onClick={() => setY(v => v - 1)} className="px-2 text-[#3b82f6] text-xl font-bold">‹</button>
            <span className="text-lg font-black text-white">{y}</span>
            <button type="button" aria-label="Next year" onClick={() => setY(v => v + 1)} className="px-2 text-[#3b82f6] text-xl font-bold">›</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((label, i) => {
              const future = isFuture(i);
              const selected = i === m;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={future}
                  onClick={() => setM(i)}
                  className={`rounded-[12px] py-3 text-sm font-bold min-h-[44px] ${
                    selected
                      ? 'bg-[#2563eb] text-white'
                      : future
                        ? 'text-zinc-600'
                        : 'text-zinc-200 hover:bg-white/5'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-[#2c2c2e] py-3.5 text-sm font-black uppercase tracking-wide text-rose-400 min-h-[48px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(y, m)}
            className="flex-[1.4] rounded-full bg-[#2563eb] py-3.5 text-sm font-black uppercase tracking-wide text-white min-h-[48px]"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
