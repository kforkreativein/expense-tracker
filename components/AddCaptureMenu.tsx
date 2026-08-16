'use client';
import { useRef, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onManual: () => void;
  onVoice: () => void;
  onImage: (file: File) => void;
  onPdf: (file: File) => void;
  voiceAvailable?: boolean;
}

export default function AddCaptureMenu({
  open, onClose, onManual, onVoice, onImage, onPdf, voiceAvailable,
}: Props) {
  const imageRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="mb-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] w-full max-w-md animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2 self-start">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#1c1c1e]/95 px-2 py-2 backdrop-blur-xl shadow-lg">
            {voiceAvailable && (
              <button
                type="button"
                aria-label="Voice detect"
                onClick={() => { onClose(); onVoice(); }}
                className="flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" />
                  <path d="M19 11a7 7 0 01-14 0M12 18v3" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <button
              type="button"
              aria-label="Upload image"
              onClick={() => imageRef.current?.click()}
              className="flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="8.5" cy="10" r="1.5" />
                <path d="M21 15l-5-5-4 4-2-2-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Upload PDF statement"
              onClick={() => pdfRef.current?.click()}
              className="flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
                <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {busy && (
            <span className="rounded-full bg-[#2c2c2e] px-3 py-2 text-xs font-bold text-zinc-300">{busy}</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => { onClose(); onManual(); }}
          className="w-full rounded-[18px] bg-[#22c55e] py-4 text-center text-base font-black text-white min-h-[52px]"
        >
          + Add manually
        </button>

        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy('Analyzing…');
            onImage(f);
            e.target.value = '';
          }}
        />
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy('Reading PDF…');
            onPdf(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
