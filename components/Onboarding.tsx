'use client';
import { useState } from 'react';

const STEPS = [
  {
    emoji: '👋',
    title: 'Welcome to Money Buddy!',
    body: "Your simple, joyful way to track where your money goes. No complicated stuff — just easy and fun!",
    bg: 'clay-purple',
  },
  {
    emoji: '💰',
    title: 'Add Income or Expense',
    body: "Got paid? Add it as Income. Spent something? Add it as Expense. Just tap the big button and fill in the amount and a quick note.",
    bg: 'clay-green',
  },
  {
    emoji: '📱💵',
    title: 'Pick How You Paid',
    body: "Choose GPay (Yes Bank or HDFC) or Cash. That's it — no complicated categories needed!",
    bg: 'clay-blue',
  },
  {
    emoji: '👀',
    title: 'Your Totals Stay Private',
    body: "Your total income and expenses are hidden by default, just like your banking app. Tap the 👁 eye icon to peek at them anytime!",
    bg: 'clay-yellow',
  },
  {
    emoji: '✏️',
    title: 'Made a Mistake? No Worries!',
    body: "Every entry has an edit button. Tap it to change anything — amount, note, date, payment mode — whatever you need!",
    bg: 'clay-amber',
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}>
      <div className={`clay animate-bounce-in w-full max-w-sm p-8 flex flex-col items-center gap-5 text-center`}>
        {/* Progress dots */}
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-violet-500' : 'w-2 bg-stone-200'}`} />
          ))}
        </div>

        {/* Content */}
        <div className={`${s.bg} clay-btn w-20 h-20 flex items-center justify-center rounded-[20px] text-4xl shadow-lg`}>
          {s.emoji}
        </div>
        <h2 className="text-2xl font-black text-stone-800">{s.title}</h2>
        <p className="text-base font-semibold text-stone-600 leading-relaxed">{s.body}</p>

        {/* Buttons */}
        <div className="flex gap-3 w-full mt-2">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="clay clay-btn flex-1 py-3 font-bold text-stone-600 text-base">
              ← Back
            </button>
          )}
          <button onClick={() => isLast ? onDone() : setStep(s => s + 1)}
            className={`clay-btn flex-1 py-3 font-black text-white text-base rounded-[16px] ${isLast ? 'bg-violet-500 shadow-lg' : 'bg-emerald-400 shadow-lg'}`}>
            {isLast ? "Let's Go! 🚀" : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
