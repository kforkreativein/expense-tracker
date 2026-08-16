export type RecorderErrorCode = 'unsupported' | 'denied' | 'no-mic' | 'insecure' | 'failed';

export class RecorderError extends Error {
  constructor(readonly code: RecorderErrorCode, message: string) {
    super(message);
    this.name = 'RecorderError';
  }
}

export function recorderMessage(code: RecorderErrorCode): string {
  switch (code) {
    case 'unsupported':
      return 'This browser cannot record audio. Try Safari or Chrome.';
    case 'denied':
      return 'Microphone blocked. Allow the mic for this site in your browser settings.';
    case 'no-mic':
      return 'No microphone found on this device.';
    case 'insecure':
      return 'Recording needs a secure (https) connection.';
    default:
      return 'Could not start recording. Please try again.';
  }
}

/** Ordered by preference; the first supported one wins. */
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
];

export function isRecordingSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function pickMimeType(): string {
  if (typeof window.MediaRecorder?.isTypeSupported !== 'function') return '';
  return MIME_CANDIDATES.find(m => window.MediaRecorder.isTypeSupported(m)) ?? '';
}

export function fileNameFor(mimeType: string): string {
  if (mimeType.includes('webm')) return 'speech.webm';
  if (mimeType.includes('ogg')) return 'speech.ogg';
  if (mimeType.includes('mpeg')) return 'speech.mp3';
  if (mimeType.includes('mp4')) return 'speech.mp4';
  return 'speech.webm';
}

/**
 * Thin MediaRecorder wrapper that also exposes a live input level so the button
 * can show that the app is really listening.
 */
export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelData: Uint8Array<ArrayBuffer> | null = null;
  private startedAt = 0;
  private stopped = false;

  get isRecording(): boolean {
    return !!this.recorder && this.recorder.state === 'recording';
  }

  get elapsedMs(): number {
    return this.startedAt ? Date.now() - this.startedAt : 0;
  }

  /** 0..1 loudness of the last sample window. */
  get level(): number {
    if (!this.analyser || !this.levelData) return 0;
    this.analyser.getByteTimeDomainData(this.levelData);
    let peak = 0;
    for (let i = 0; i < this.levelData.length; i++) {
      peak = Math.max(peak, Math.abs(this.levelData[i] - 128) / 128);
    }
    return Math.min(1, peak * 1.8);
  }

  async start(): Promise<void> {
    if (!isRecordingSupported()) {
      throw new RecorderError('unsupported', recorderMessage('unsupported'));
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new RecorderError('insecure', recorderMessage('insecure'));
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        throw new RecorderError('denied', recorderMessage('denied'));
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        throw new RecorderError('no-mic', recorderMessage('no-mic'));
      }
      throw new RecorderError('failed', recorderMessage('failed'));
    }

    const mimeType = pickMimeType();
    try {
      this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    } catch {
      this.releaseStream();
      throw new RecorderError('failed', recorderMessage('failed'));
    }

    this.chunks = [];
    this.stopped = false;
    this.recorder.ondataavailable = event => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start();
    this.startedAt = Date.now();
    this.attachMeter();
  }

  /** Stops and returns the recording. Resolves null when nothing was captured. */
  stop(): Promise<{ blob: Blob; mimeType: string; durationMs: number } | null> {
    const recorder = this.recorder;
    if (!recorder || this.stopped) {
      this.cleanup();
      return Promise.resolve(null);
    }
    this.stopped = true;
    const durationMs = this.elapsedMs;

    return new Promise(resolve => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || this.chunks[0]?.type || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        this.cleanup();
        resolve(blob.size > 0 ? { blob, mimeType, durationMs } : null);
      };
      try {
        if (recorder.state !== 'inactive') recorder.stop();
        else recorder.onstop?.(new Event('stop'));
      } catch {
        this.cleanup();
        resolve(null);
      }
    });
  }

  /** Throws the recording away — used when the user changes their mind. */
  cancel(): void {
    this.stopped = true;
    try {
      if (this.recorder && this.recorder.state !== 'inactive') {
        this.recorder.onstop = null;
        this.recorder.stop();
      }
    } catch {
      // already stopped
    }
    this.chunks = [];
    this.cleanup();
  }

  private attachMeter() {
    if (!this.stream) return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.audioContext = new Ctor();
      void this.audioContext.resume();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.levelData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
      source.connect(this.analyser);
    } catch {
      // The level meter is decoration; recording still works without it.
      this.analyser = null;
    }
  }

  private releaseStream() {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
  }

  private cleanup() {
    this.releaseStream();
    this.analyser = null;
    this.levelData = null;
    if (this.audioContext) {
      void this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.recorder = null;
    this.startedAt = 0;
  }
}
