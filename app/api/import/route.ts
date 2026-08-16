import { NextResponse } from 'next/server';
import { GroqError, isGroqConfigured, parseVoiceText } from '@/lib/server/groq';
import { bearerToken, isAuthConfigured, isSameOrigin, verifyAccessToken } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { VoiceContext, VoiceContextItem, VoiceErrorResult, VoiceResult } from '@/lib/voice/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

function fail(code: VoiceErrorResult['code'], error: string, status: number) {
  return NextResponse.json<VoiceErrorResult>({ error, code }, { status, headers: NO_STORE });
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

async function describeImage(base64: string, mime: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new GroqError('GROQ_API_KEY is not set', 503);

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract every money transaction visible in this receipt, screenshot, or bank statement image. List each as a short spoken-style note like "spent 450 on dinner" or "received 20000 salary". Include date if shown. Indian rupees. Reply with only the list, one transaction per line.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${base64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new GroqError(`vision failed (${res.status}): ${body.slice(0, 400)}`, 502);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail('unauthorized', 'Request blocked.', 403);
  if (!isGroqConfigured()) return fail('not_configured', 'Import is not set up on the server yet.', 503);
  if (!isAuthConfigured()) return fail('not_configured', 'Auth is not configured.', 503);

  const token = bearerToken(request);
  if (!token) return fail('unauthorized', 'Sign in again to import.', 401);
  const user = await verifyAccessToken(token);
  if (!user) return fail('unauthorized', 'Session expired. Sign in again.', 401);

  const limited = checkRateLimit(`import:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limited.ok) {
    return fail('rate_limited', 'Too many imports. Try again in a few minutes.', 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('bad_request', 'Could not read upload.', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) return fail('bad_request', 'No file uploaded.', 400);
  if (file.size > MAX_BYTES) return fail('bad_request', 'File is too large (max 8 MB).', 400);
  if (file.size < 40) return fail('bad_request', 'File looks empty.', 400);

  const mime = (file.type || 'application/octet-stream').toLowerCase();
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isImage && !isPdf) {
    return fail('bad_request', 'Upload a photo or PDF statement.', 400);
  }

  let context: VoiceContext;
  try {
    context = buildContext(JSON.parse(String(form.get('context') ?? '{}')));
  } catch {
    context = buildContext({});
  }

  try {
    let text = '';
    if (isImage) {
      const buf = Buffer.from(await file.arrayBuffer());
      text = await describeImage(buf.toString('base64'), mime || 'image/jpeg');
    } else {
      // PDFs: ask the model via a short text prompt after reading raw bytes as latin1 snippet
      // (many bank PDFs are image-based; user can screenshot those pages).
      const buf = Buffer.from(await file.arrayBuffer());
      const snippet = buf.toString('latin1').replace(/[^\x20-\x7E\n]/g, ' ').slice(0, 12000);
      if (snippet.trim().length < 40) {
        return fail('bad_request', 'This PDF looks image-only. Screenshot the statement and upload the photo instead.', 400);
      }
      text = `Bank statement extract:\n${snippet}\n\nList each debit/credit as "spent X on Y" or "received X salary".`;
    }

    if (!text) return fail('bad_request', 'Could not read anything from that file.', 400);
    const parsed = await parseVoiceText(text, context);
    const result: VoiceResult = { ...parsed, transcript: text.slice(0, 500) };
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof GroqError) {
      return fail(err.status === 503 ? 'not_configured' : 'upstream', err.message, err.status === 503 ? 503 : 502);
    }
    return fail('upstream', 'Import failed. Try again.', 502);
  }
}
