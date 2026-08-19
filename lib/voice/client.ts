import { getSupabase, isSupabaseEnabled } from '../supabase/client';
import { getWallets } from '../wallets';
import { getCategories } from '../categories';
import { getSpendCategories, spendCategoryHints } from '../spendCategories';
import { getTransactions } from '../storage';
import { legacyWalletId } from '../wallets';
import { fileNameFor } from './recorder';
import { VoiceContext, VoiceErrorResult, VoiceResult } from './types';

export class VoiceRequestError extends Error {
  constructor(readonly code: VoiceErrorResult['code'], message: string) {
    super(message);
    this.name = 'VoiceRequestError';
  }
}

const today = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

/** The wallet used most in the last 30 entries — the best guess when none is spoken. */
export function mostUsedWalletId(): string | null {
  const wallets = getWallets();
  if (!wallets.length) return null;

  const recent = [...getTransactions()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30);

  const counts = new Map<string, number>();
  for (const txn of recent) {
    const id = txn.walletId ?? legacyWalletId(txn.paymentMode, txn.bank);
    if (wallets.some(w => w.id === id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best ?? wallets[0].id;
}

export function buildVoiceContext(extra?: { splitMembers?: string[] }): VoiceContext {
  const types = getCategories();
  const spendCategories = getSpendCategories();

  return {
    today: today(),
    wallets: getWallets().map(w => ({ id: w.id, name: w.name })),
    types: types.map(c => ({ id: c.id, name: c.name })),
    spendCategories: spendCategories.map(c => ({ id: c.id, name: c.name })),
    spendCategoryHints: spendCategoryHints(spendCategories),
    defaultWalletId: mostUsedWalletId(),
    defaultTypeId: types.find(c => c.name.trim().toLowerCase() === 'personal')?.id ?? null,
    splitMembers: (extra?.splitMembers ?? []).map(name => ({ id: name, name })),
  };
}

async function accessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Voice needs a cloud login, because that is what authorises the server call. */
export function voiceNeedsCloudLogin(): boolean {
  return !isSupabaseEnabled();
}

let configuredCache: boolean | null = null;

/** Asks the server once whether the Groq key is present. */
export async function isVoiceConfigured(): Promise<boolean> {
  if (configuredCache !== null) return configuredCache;
  if (!isSupabaseEnabled()) {
    configuredCache = false;
    return false;
  }
  try {
    const res = await fetch('/api/voice', { method: 'GET' });
    if (!res.ok) {
      configuredCache = false;
      return false;
    }
    const data = (await res.json()) as { configured?: boolean };
    configuredCache = !!data.configured;
  } catch {
    configuredCache = false;
  }
  return configuredCache;
}

async function postVoiceForm(form: FormData, offlineMsg: string, failMsg: string): Promise<VoiceResult> {
  const token = await accessToken();
  if (!token) {
    throw new VoiceRequestError('unauthorized', 'Please log in again to use voice entry.');
  }

  let res: Response;
  try {
    res = await fetch('/api/voice', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new VoiceRequestError('upstream', offlineMsg);
  }

  if (!res.ok) {
    let payload: Partial<VoiceErrorResult> = {};
    try {
      payload = (await res.json()) as Partial<VoiceErrorResult>;
    } catch {
      // fall through
    }
    throw new VoiceRequestError(payload.code ?? 'server', payload.error ?? failMsg);
  }

  return (await res.json()) as VoiceResult;
}

export async function transcribeVoice(blob: Blob, mimeType: string, splitMembers?: string[]): Promise<VoiceResult> {
  const form = new FormData();
  form.append('audio', new File([blob], fileNameFor(mimeType), { type: mimeType }));
  form.append('context', JSON.stringify(buildVoiceContext({ splitMembers })));
  return postVoiceForm(
    form,
    'No internet connection. Voice entry needs to be online.',
    'Voice entry failed. Please try again.',
  );
}

/** Type a short note; server uses the same AI parser as voice. */
export async function parseQuickText(text: string): Promise<VoiceResult> {
  const form = new FormData();
  form.append('text', text.trim().slice(0, 500));
  form.append('context', JSON.stringify(buildVoiceContext()));
  return postVoiceForm(
    form,
    'No internet connection. Text entry needs to be online.',
    'Could not understand that text. Please try again.',
  );
}

/** Upload a receipt photo or statement PDF for AI parsing into draft entries. */
export async function importStatementFile(file: File): Promise<VoiceResult> {
  const token = await accessToken();
  if (!token) {
    throw new VoiceRequestError('unauthorized', 'Please log in again to import.');
  }

  const form = new FormData();
  form.append('file', file, file.name);
  form.append('context', JSON.stringify(buildVoiceContext()));

  let res: Response;
  try {
    res = await fetch('/api/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new VoiceRequestError('upstream', 'No internet connection. Import needs to be online.');
  }

  if (!res.ok) {
    let payload: Partial<VoiceErrorResult> = {};
    try {
      payload = (await res.json()) as Partial<VoiceErrorResult>;
    } catch {
      // ignore
    }
    throw new VoiceRequestError(
      payload.code ?? 'server',
      payload.error ?? 'Import failed. Please try again.',
    );
  }

  return (await res.json()) as VoiceResult;
}
