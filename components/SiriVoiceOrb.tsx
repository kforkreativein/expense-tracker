'use client';
import { useRef, useState } from 'react';

interface Props {
  active?: boolean;
  onActivate: () => void;
}

/**
 * Compact Siri-style orb. Hold (~400ms) or double-tap to start voice capture.
 */
export default function SiriVoiceOrb({ active, onActivate }: Props) {
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const fired = useRef(false);

  function clearHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
  }

  function fire() {
    if (fired.current) return;
    fired.current = true;
    onActivate();
    setTimeout(() => { fired.current = false; }, 600);
  }

  function onPointerDown() {
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      fire();
      setHolding(false);
    }, 420);
  }

  function onPointerUp() {
    const wasHolding = !!holdTimer.current;
    clearHold();
    if (!wasHolding) return;
    // Short tap — check double-tap
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      fire();
    } else {
      lastTap.current = now;
    }
  }

  return (
    <button
      type="button"
      aria-label="Hold or double-tap to talk"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={clearHold}
      onPointerCancel={clearHold}
      className="siri-orb relative mx-auto flex h-10 w-10 items-center justify-center"
    >
      <span className={`siri-orb__glow ${holding || active ? 'is-holding' : ''}`} />
    </button>
  );
}
