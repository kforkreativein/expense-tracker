'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { RecorderError, VoiceRecorder, isRecordingSupported, recorderMessage } from '@/lib/voice/recorder';
import { VoiceRequestError, transcribeVoice } from '@/lib/voice/client';
import { VoiceResult } from '@/lib/voice/types';

interface Props {
  onResult: (result: VoiceResult) => void;
  /** Start listening immediately (deep link from the phone shortcut). */
  autoStart?: boolean;
}

type Phase = 'idle' | 'starting' | 'recording' | 'sending';
type Mode = 'hold' | 'handsfree';

/** Held longer than this and it counts as hold-to-talk rather than a tap. */
const HOLD_DELAY_MS = 220;
const DOUBLE_TAP_MS = 320;
const MAX_RECORDING_MS = 20_000;
const MIN_RECORDING_MS = 500;
const WARN_AT_MS = 15_000;
const BAR_COUNT = 9;

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // vibration is a nicety, never required
  }
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Recording support is a browser-only fact; the server snapshot must be false. */
const subscribeNever = () => () => {};
const serverSnapshot = () => false;

export default function VoiceButton({ onResult, autoStart = false }: Props) {
  const supported = useSyncExternalStore(subscribeNever, isRecordingSupported, serverSnapshot);
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode>('hold');
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0));
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef(0);
  /** False as soon as the user lets go, so an in-flight start() can bail out. */
  const wantedRef = useRef(false);
  const phaseRef = useRef<Phase>('idle');
  const modeRef = useRef<Mode>('hold');

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const clearTimers = useCallback(() => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    if (meterRef.current) { clearInterval(meterRef.current); meterRef.current = null; }
  }, []);

  const resetVisuals = useCallback(() => {
    setElapsed(0);
    setLevels(Array(BAR_COUNT).fill(0));
  }, []);

  const showHint = useCallback((message: string) => {
    setHint(message);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHint(''), 2800);
  }, []);

  const send = useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    clearTimers();
    if (!recorder) {
      setPhase('idle');
      resetVisuals();
      return;
    }

    const captured = await recorder.stop();
    resetVisuals();

    if (!captured || captured.durationMs < MIN_RECORDING_MS) {
      setPhase('idle');
      showHint('Too short — hold the mic while you speak.');
      return;
    }

    setPhase('sending');
    buzz(12);
    try {
      const result = await transcribeVoice(captured.blob, captured.mimeType);
      setPhase('idle');
      onResult(result);
    } catch (err) {
      setPhase('idle');
      setError(
        err instanceof VoiceRequestError
          ? err.message
          : 'Voice entry failed. Please try again.',
      );
    }
  }, [clearTimers, onResult, resetVisuals, showHint]);

  const begin = useCallback(async (nextMode: Mode) => {
    if (phaseRef.current !== 'idle') return;
    setError('');
    setHint('');
    setMode(nextMode);
    modeRef.current = nextMode;
    setPhase('starting');

    const recorder = new VoiceRecorder();
    try {
      await recorder.start();
    } catch (err) {
      setPhase('idle');
      setError(err instanceof RecorderError ? err.message : recorderMessage('failed'));
      return;
    }

    // Released while the browser was still opening the mic
    if (!wantedRef.current && nextMode === 'hold') {
      recorder.cancel();
      setPhase('idle');
      showHint('Hold the mic a little longer while you speak.');
      return;
    }

    recorderRef.current = recorder;
    setPhase('recording');
    buzz(18);

    meterRef.current = setInterval(() => {
      const active = recorderRef.current;
      if (!active) return;
      setElapsed(active.elapsedMs);
      const level = active.level;
      setLevels(prev => [...prev.slice(1), level]);
    }, 70);

    autoStopRef.current = setTimeout(() => {
      showHint('20 second limit reached.');
      void send();
    }, MAX_RECORDING_MS);
  }, [send, showHint]);

  const cancel = useCallback(() => {
    wantedRef.current = false;
    clearTimers();
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setPhase('idle');
    resetVisuals();
  }, [clearTimers, resetVisuals]);

  useEffect(() => {
    if (!autoStart || !supported) return;
    wantedRef.current = true;
    // A tick after mount, so the mic prompt does not fight the first paint
    const id = setTimeout(() => { void begin('handsfree'); }, 0);
    return () => clearTimeout(id);
  }, [autoStart, supported, begin]);

  useEffect(() => () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    clearTimers();
    recorderRef.current?.cancel();
    recorderRef.current = null;
  }, [clearTimers]);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (phase === 'sending' || phase === 'starting') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    // A tap while hands-free is running means "stop" — handled on release
    if (phase === 'recording') return;

    wantedRef.current = true;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      void begin('hold');
    }, HOLD_DELAY_MS);
  }

  function handlePointerUp() {
    const wasHoldPending = !!holdTimerRef.current;
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    wantedRef.current = false;

    if (phaseRef.current === 'recording') {
      if (modeRef.current === 'hold') {
        const active = recorderRef.current;
        if (active && active.elapsedMs < MIN_RECORDING_MS) {
          cancel();
          showHint('Too short — hold the mic while you speak.');
          return;
        }
      }
      void send();
      return;
    }

    if (phaseRef.current === 'starting') {
      // begin() will notice wantedRef and clean up
      return;
    }

    if (!wasHoldPending) return;

    // Quick tap: a second one within the window starts hands-free listening
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      wantedRef.current = true;
      void begin('handsfree');
      return;
    }
    lastTapRef.current = now;
    showHint('Hold to talk, or double-tap for hands-free.');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (phase === 'recording') void send();
    else if (phase === 'idle') { wantedRef.current = true; void begin('handsfree'); }
  }

  if (!supported) return null;

  const isRecording = phase === 'recording';
  const isBusy = phase === 'sending' || phase === 'starting';
  const nearLimit = elapsed >= WARN_AT_MS;

  return (
    <>
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        onContextMenu={e => e.preventDefault()}
        disabled={isBusy}
        aria-label={isRecording ? 'Stop recording' : 'Hold to record an entry by voice'}
        aria-pressed={isRecording}
        className={`clay-btn clay shrink-0 w-[60px] min-h-[52px] flex items-center justify-center text-2xl relative select-none touch-none ${
          isRecording ? 'clay-red' : isBusy ? 'clay-amber opacity-80' : 'clay-amber'
        }`}
        style={{ WebkitTouchCallout: 'none' }}>
        {isBusy && phase === 'sending' ? '⏳' : isRecording ? '⏺️' : '🎤'}
        {isRecording && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-[20px] border-2 border-rose-400/70 animate-ping pointer-events-none"
          />
        )}
      </button>

      {hint && !isRecording && phase !== 'sending' && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 z-50 clay clay-amber animate-pop-in px-4 py-2.5 max-w-[20rem] text-center"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
          <p className="text-xs font-black text-amber-900">{hint}</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="fixed left-1/2 -translate-x-1/2 z-50 clay clay-red animate-pop-in px-4 py-3 max-w-[20rem] flex items-start gap-2"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
          <p className="text-xs font-bold text-red-900 flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Dismiss"
            className="clay-btn text-red-900 font-black text-xs px-2 rounded-[8px] bg-white/50 min-h-[28px]">
            ✕
          </button>
        </div>
      )}

      {(isRecording || phase === 'sending') && (
        <div
          className="fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
          <div className="clay animate-slide-up w-full max-w-sm px-4 py-3.5 flex items-center gap-3 pointer-events-auto">
            {phase === 'sending' ? (
              <>
                <span className="text-xl animate-wiggle" aria-hidden>🧠</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-stone-700">Understanding what you said…</p>
                  <p className="text-[11px] font-semibold text-stone-400">Just a moment</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-end gap-[3px] h-8 w-[74px] shrink-0" aria-hidden>
                  {levels.map((level, i) => (
                    <span
                      key={i}
                      className="flex-1 rounded-full bg-rose-400"
                      style={{
                        height: `${Math.max(12, Math.min(100, level * 100))}%`,
                        transition: 'height 70ms linear',
                        opacity: 0.55 + (i / BAR_COUNT) * 0.45,
                      }}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-stone-700 truncate">
                    Listening… {formatElapsed(elapsed)}
                  </p>
                  <p className={`text-[11px] font-bold ${nearLimit ? 'text-rose-500' : 'text-stone-400'}`}>
                    {nearLimit
                      ? `${Math.max(0, Math.ceil((MAX_RECORDING_MS - elapsed) / 1000))}s left`
                      : mode === 'hold' ? 'Release to save' : 'Tap the mic to stop'}
                  </p>
                </div>
                <button
                  type="button"
                  onPointerDown={e => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={cancel}
                  className="clay-btn shrink-0 text-xs font-black text-stone-500 px-3 py-2 rounded-[12px] bg-stone-100 border border-stone-200 shadow-none">
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
