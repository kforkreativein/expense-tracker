import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function isAuthConfigured(): boolean {
  return Boolean(URL && ANON_KEY);
}

/**
 * Checks the caller's Supabase access token with Supabase itself, so an expired
 * or forged token is rejected. Returns the verified user id, never trusting any
 * id sent by the client.
 */
export async function verifyAccessToken(token: string): Promise<string | null> {
  if (!isAuthConfigured() || !token) return null;

  const supabase = createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

export function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : '';
}

/**
 * Rejects cross-site POSTs. The browser always sends Origin for these requests,
 * so a mismatch means the call did not come from the app.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser client (curl, shortcut) — the token still gates it

  try {
    const originHost = new globalThis.URL(origin).host;
    const forwardedHost = request.headers.get('x-forwarded-host');
    const host = forwardedHost || request.headers.get('host') || new globalThis.URL(request.url).host;
    return originHost === host;
  } catch {
    return false;
  }
}
