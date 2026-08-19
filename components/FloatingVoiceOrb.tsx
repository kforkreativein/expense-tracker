'use client';
import VoiceButton from './VoiceButton';
import { VoiceResult } from '@/lib/voice/types';

interface Props {
  onResult: (result: VoiceResult) => void;
  /** Start listening immediately (deep link from the phone shortcut / menu). */
  autoStart?: boolean;
  /** Other members of the split group currently open, so speech can be parsed as a shared bill. */
  splitMembers?: string[];
}

/**
 * The single voice control for the whole app: one orb, fixed just above the
 * bottom dock. Tap-hold to talk, double-tap for hands-free — no separate
 * activation step and no separate mic button.
 */
export default function FloatingVoiceOrb({ onResult, autoStart, splitMembers }: Props) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.25rem)' }}
    >
      <div className="pointer-events-auto">
        <VoiceButton variant="orb" autoStart={autoStart} splitMembers={splitMembers} onResult={onResult} />
      </div>
    </div>
  );
}
