'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const EMOJIS = [
  '💳', '💵', '📱', '🏦', '🏷️', '🛒', '🍔', '🚗',
  '🏠', '💼', '🎁', '📈', '✈️', '🎓', '💊', '⚡',
  '☕', '🎬', '👕', '🐾', '💡', '🎉', '❤️', '⭐',
];

interface Props {
  value: string;
  onChange: (emoji: string) => void;
  label?: string;
}

export default function EmojiPicker({ value, onChange, label = 'Pick icon' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const width = 220;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const top = rect.bottom + 8;
    setPos({ top, left });
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="clay-btn clay w-12 h-12 flex items-center justify-center text-2xl leading-none"
        aria-label={label}
        aria-expanded={open}>
        {value || '🏷️'}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] cursor-default bg-transparent"
            aria-label="Close icon picker"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[90] clay p-2.5 grid grid-cols-4 gap-1.5 w-[220px] max-h-[min(280px,50dvh)] overflow-y-auto"
            style={{ top: pos.top, left: pos.left }}>
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => { onChange(emoji); setOpen(false); }}
                className={`clay-btn w-11 h-11 flex items-center justify-center text-2xl rounded-[12px] ${
                  value === emoji ? 'ring-2 ring-violet-400' : ''
                }`}>
                {emoji}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
