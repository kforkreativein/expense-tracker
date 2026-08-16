import { NextResponse } from 'next/server';
import { GroqError, isGroqConfigured, parseVoiceText, transcribeAudio } from '@/lib/server/groq';
import { bearerToken, isAuthConfigured, isSameOrigin, verifyAccessToken } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { VoiceContext, VoiceContextItem, VoiceErrorResult, VoiceResult } from '@/lib/voice/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Whisper accepts up to 25 MB; a spoken entry is a couple of seconds. */
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MIN_AUDIO_BYTES = 800;

const ALLOWED_AUDIO_PREFIXES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'video/mp4'];

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function fail(code: VoiceErrorResult['code'], error: string, status: number, extraHeaders?: Record<string, string>) {
  return NextResponse.json<VoiceErrorResult>({ error, code }, { status, headers: { ...NO_STORE, ...extraHeaders } });
}

/** Lets the app hide the microphone instead of showing a button that cannot work. */
export async function GET() {
  return NextResponse.json(
    { configured: isGroqConfigured() && isAuthConfigured() },
    { headers: NO_STORE },
  );
}

function cleanItems(value: unknown, max: number): VoiceContextItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(item => ({
      id: String(item.id ?? '').slice(0, 64),
      name: String(item.name ?? '').slice(0, 40),
    }))
    .filter(item => item.id && item.name)
    .slice(0, max);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function buildContext(raw: unknown): VoiceContext {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const today = typeof obj.today === 'string' && ISO_DATE.test(obj.today)
    ? obj.today
    : new Date().toISOString().slice(0, 10);

  return {
    today,
    wallets: cleanItems(obj.wallets, 30),
    types: cleanItems(obj.types, 30),
    spendCategories: cleanItems(obj.spendCategories, 40),
    spendCategoryHints: typeof obj.spendCategoryHints === 'string' ? obj.spendCategoryHints.slice(0, 1200) : '',
    defaultWalletId: typeof obj.defaultWalletId === 'string' ? obj.defaultWalletId.slice(0, 64) : null,
    defaultTypeId: typeof obj.defaultTypeId === 'string' ? obj.defaultTypeId.slice(0, 64) : null,
  };
}

/** Nudges Whisper towards the right spellings without steering the content. */
function transcriptionHint(ctx: VoiceContext): string {
  const names = [...ctx.wallets, ...ctx.spendCategories].map(i => i.name).slice(0, 25);
  return `Personal expense note in Indian English or Hindi. Amounts in rupees. Names: ${names.join(', ')}.`;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return fail('unauthorized', 'Request blocked.', 403);
  }

  if (!isGroqConfigured()) {
    return fail('not_configured', 'Voice entry is not set up on the server yet.', 503);
  }

  if (!isAuthConfigured()) {
    return fail('not_configured', 'Cloud login is not configured, so voice entry cannot verify you.', 503);
  }

  const userId = await verifyAccessToken(bearerToken(request));
  if (!userId) {
    return fail('unauthorized', 'Please log in again to use voice entry.', 401);
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_AUDIO_BYTES + 64 * 1024) {
    return fail('too_large', 'That recording is too long. Please keep it under 20 seconds.', 413);
  }

  const limit = checkRateLimit(`voice:${userId}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return fail('rate_limited', 'Too many voice entries in a row. Please wait a minute.', 429, {
      'Retry-After': String(limit.retryAfter),
    });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('bad_request', 'Could not read the recording.', 400);
  }

  const audio = form.get('audio');
  if (!(audio instanceof File)) {
    return fail('bad_request', 'No recording was attached.', 400);
  }
  if (audio.size < MIN_AUDIO_BYTES) {
    return fail('bad_request', 'That was too short — hold the mic and speak, then let go.', 400);
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return fail('too_large', 'That recording is too long. Please keep it under 20 seconds.', 413);
  }

  const mime = (audio.type || '').split(';')[0].trim().toLowerCase();
  if (mime && !ALLOWED_AUDIO_PREFIXES.includes(mime)) {
    return fail('bad_request', 'That audio format is not supported.', 400);
  }

  const rawContext = form.get('context');
  let context: VoiceContext;
  try {
    context = buildContext(typeof rawContext === 'string' ? JSON.parse(rawContext) : {});
  } catch {
    return fail('bad_request', 'Could not read your wallet and category list.', 400);
  }

  try {
    const transcript = await transcribeAudio(audio, transcriptionHint(context));

    if (!transcript) {
      return NextResponse.json<VoiceResult>(
        {
          transcript: '',
          intent: 'unclear',
          entries: [],
          query: null,
          note: 'I could not hear anything. Please try again in a quieter spot.',
        },
        { headers: NO_STORE },
      );
    }

    const parsed = await parseVoiceText(transcript, context);

    return NextResponse.json<VoiceResult>(
      { transcript, ...parsed },
      { headers: NO_STORE },
    );
  } catch (err) {
    // Log server-side only — the response must never echo upstream details
    console.error('voice route failed', err);
    if (err instanceof GroqError && err.status === 503) {
      return fail('not_configured', 'Voice entry is not set up on the server yet.', 503);
    }
    return fail('upstream', 'Voice service is busy right now. Please try again.', 502);
  }
}
