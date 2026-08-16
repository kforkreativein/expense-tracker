'use client';
import { useRef, useState } from 'react';

const HOLD_MS = 380;

export default function SiriHoldTop() {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function goTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startHold() {
    setHolding(true);
    timer.current = setTimeout(() => {
      goTop();
      setHolding(false);
    }, HOLD_MS);
  }

  function cancelHold() {
    if (timer.current) clearTimeout(timer.current);
    setHolding(false);
  }

  return (
    <button
      type="button"
      aria-label="Hold to jump to top"
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      className="siri-orb mx-auto flex h-7 w-16 items-center justify-center"
    >
      <span className={`siri-orb__blob ${holding ? 'is-holding' : ''}`} />
    </button>
  );
}
