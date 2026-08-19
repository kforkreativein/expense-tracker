import {
  isSupabaseEnabled,
  supabaseRegister,
  supabaseLogin,
  supabaseLogout,
  supabaseRestoreAuth,
  supabaseUpdateDisplayName,
} from './supabase/auth';
import { pullFromCloud, pushToCloud, syncWithCloud } from './supabase/sync';

export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  displayName: string;
  createdAt: number;
}

export interface Session {
  userId: string;
  username: string;
  displayName: string;
}

export interface SavedLogin {
  username: string;
  password: string;
}

const USERS_KEY = 'money_buddy_users';
const SESSION_KEY = 'money_buddy_session';
const SAVED_LOGIN_KEY = 'money_buddy_saved_login';

// Lower iterations = faster on phones (home-screen PWA can feel stuck at 100k)
const PBKDF2_ITERATIONS = 10_000;

const LEGACY_KEYS = [
  'money_buddy_txns',
  'money_buddy_wallets',
  'money_buddy_recurring',
  'money_buddy_subscriptions',
  'money_buddy_name',
  'money_buddy_budget',
  'onboarding_done',
] as const;

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return localStorage.getItem(key) === value;
  } catch {
    return false;
  }
}

function safeRemoveItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

export function canUseStorage(): boolean {
  if (typeof window === 'undefined') return false;
  const probe = '__money_buddy_storage_probe__';
  if (!safeSetItem(probe, '1')) return false;
  safeRemoveItem(probe);
  return true;
}

function getUsers(): UserAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(safeGetItem(USERS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveUsers(users: UserAccount[]): boolean {
  return safeSetItem(USERS_KEY, JSON.stringify(users));
}

function findUserById(userId: string): UserAccount | undefined {
  return getUsers().find(u => u.id === userId);
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  if (!crypto?.subtle) {
    throw new Error('SECURE_CONTEXT_REQUIRED');
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBuffer = new Uint8Array(salt);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function saltToHex(salt: Uint8Array): string {
  return Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
}

function saltFromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = safeGetItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session?.userId) {
      safeRemoveItem(SESSION_KEY);
      return null;
    }
    if (!isSupabaseEnabled() && !findUserById(session.userId)) {
      safeRemoveItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function getCurrentUserId(): string | null {
  return getSession()?.userId ?? null;
}

export function userStorageKey(base: string): string {
  const userId = getCurrentUserId();
  if (!userId) return base;
  return `${base}_${userId}`;
}

function setSession(user: UserAccount): boolean {
  const session: Session = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
  };
  return safeSetItem(SESSION_KEY, JSON.stringify(session));
}

export function saveLoginCredentials(username: string, password: string) {
  const saved: SavedLogin = { username: username.trim().toLowerCase(), password };
  safeSetItem(SAVED_LOGIN_KEY, JSON.stringify(saved));
}

export function getSavedLoginCredentials(): SavedLogin | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = safeGetItem(SAVED_LOGIN_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedLogin;
    if (!saved?.username || !saved?.password) return null;
    return saved;
  } catch {
    return null;
  }
}

/** Set up default wallets for a brand-new user. */
function initUserData(userId: string) {
  const walletKey = `money_buddy_wallets_${userId}`;
  if (!safeGetItem(walletKey)) {
    safeSetItem(walletKey, JSON.stringify([
      { id: 'gpay_hdfc', name: 'HDFC Bank', emoji: '📱' },
      { id: 'gpay_yes', name: 'Yes Bank', emoji: '📱' },
      { id: 'cash', name: 'Cash', emoji: '💵' },
    ]));
  }
}

export function logout() {
  if (isSupabaseEnabled()) {
    void supabaseLogout();
  }
  safeRemoveItem(SESSION_KEY);
}

export async function restoreAuth(): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const ok = await supabaseRestoreAuth();
    if (ok) {
      try {
        await pullFromCloud();
      } catch {
        await syncWithCloud();
      }
      return true;
    }
    const saved = getSavedLoginCredentials();
    if (saved) {
      const result = await login(saved.username, saved.password, { saveCredentials: false });
      if (result.ok) {
        try {
          await pullFromCloud();
        } catch {
          await syncWithCloud();
        }
        return true;
      }
    }
    return false;
  }
  return !!getSession();
}

function storageErrorMessage(): string {
  if (isStandalonePwa()) {
    return 'Could not save data in the home-screen app. Close other tabs, free up space, then try again.';
  }
  return 'Could not save data in this browser. Check storage settings and try again.';
}

function loginErrorMessage(userFound: boolean): string {
  if (!userFound && isStandalonePwa()) {
    return 'No account in this app yet. Tap "Sign up" below to create one here — the home-screen app is separate from Safari/browser.';
  }
  if (!userFound) {
    return 'Wrong username or password';
  }
  return 'Wrong password. Please type it again (autofill can be wrong on the home-screen app).';
}

function authFailureMessage(err: unknown): string {
  if (err instanceof Error && err.message === 'SECURE_CONTEXT_REQUIRED') {
    return 'Secure login is not available here. Open the app via HTTPS.';
  }
  if (isStandalonePwa()) {
    return 'Login failed on the home-screen app. Please try again, or sign up if you have not created an account in this app yet.';
  }
  return 'Login failed. Please try again.';
}

/** Copy any pre-login local data into the new user's scoped keys (one-time). */
function migrateLegacyData(userId: string) {
  const migratedFlag = `money_buddy_migrated_${userId}`;
  if (safeGetItem(migratedFlag)) return;

  for (const key of LEGACY_KEYS) {
    const value = safeGetItem(key);
    if (value != null) {
      safeSetItem(`${key}_${userId}`, value);
    }
  }
  safeSetItem(migratedFlag, '1');
}

export async function register(
  username: string,
  password: string,
  displayName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!canUseStorage()) {
      return { ok: false, error: storageErrorMessage() };
    }

    const trimmedUser = username.trim().toLowerCase();
    const trimmedName = displayName.trim();
    if (!trimmedUser || trimmedUser.length < 3) {
      return { ok: false, error: 'Username must be at least 3 characters' };
    }
    if (!password || password.length < 4) {
      return { ok: false, error: 'Password must be at least 4 characters' };
    }
    if (!trimmedName) {
      return { ok: false, error: 'Please enter your name' };
    }

    if (isSupabaseEnabled()) {
      const result = await supabaseRegister(trimmedUser, password, trimmedName);
      if (!result.ok) return result;
      initUserData(getCurrentUserId()!);
      migrateLegacyData(getCurrentUserId()!);
      saveLoginCredentials(trimmedUser, password);
      try {
        await pushToCloud();
      } catch (err) {
        console.error('initial cloud push failed', err);
      }
      return { ok: true };
    }

    const users = getUsers();
    if (users.some(u => u.username === trimmedUser)) {
      return { ok: false, error: 'That username is already taken' };
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passwordHash = await hashPassword(password, salt);
    const user: UserAccount = {
      id: crypto.randomUUID(),
      username: trimmedUser,
      passwordHash,
      salt: saltToHex(salt),
      displayName: trimmedName,
      createdAt: Date.now(),
    };

    if (!saveUsers([...users, user])) {
      return { ok: false, error: storageErrorMessage() };
    }
    if (!findUserById(user.id)) {
      return { ok: false, error: storageErrorMessage() };
    }
    if (!setSession(user)) {
      return { ok: false, error: storageErrorMessage() };
    }

    initUserData(user.id);
    migrateLegacyData(user.id);
    saveLoginCredentials(trimmedUser, password);
    return { ok: true };
  } catch (err) {
    console.error('register failed', err);
    return { ok: false, error: authFailureMessage(err) };
  }
}

export async function login(
  username: string,
  password: string,
  options: { saveCredentials?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!canUseStorage()) {
      return { ok: false, error: storageErrorMessage() };
    }

    const trimmedUser = username.trim().toLowerCase();

    if (isSupabaseEnabled()) {
      const result = await supabaseLogin(trimmedUser, password);
      if (!result.ok) return { ok: false, error: loginErrorMessage(false) };
      initUserData(getCurrentUserId()!);
      if (options.saveCredentials !== false) {
        saveLoginCredentials(trimmedUser, password);
      }
      try {
        await pullFromCloud();
      } catch {
        await syncWithCloud();
      }
      return { ok: true };
    }

    const user = getUsers().find(u => u.username === trimmedUser);
    if (!user) return { ok: false, error: loginErrorMessage(false) };

    const hash = await hashPassword(password, saltFromHex(user.salt));
    if (hash !== user.passwordHash) {
      return { ok: false, error: loginErrorMessage(true) };
    }

    if (!setSession(user)) {
      return { ok: false, error: storageErrorMessage() };
    }

    initUserData(user.id);
    if (options.saveCredentials !== false) {
      saveLoginCredentials(trimmedUser, password);
    }
    return { ok: true };
  } catch (err) {
    console.error('login failed', err);
    return { ok: false, error: authFailureMessage(err) };
  }
}

export function updateDisplayName(name: string) {
  const session = getSession();
  if (!session) return;
  const trimmed = name.trim();
  if (!trimmed) return;

  if (isSupabaseEnabled()) {
    void supabaseUpdateDisplayName(trimmed);
    return;
  }

  const users = getUsers().map(u =>
    u.id === session.userId ? { ...u, displayName: trimmed } : u,
  );
  saveUsers(users);
  const updated = users.find(u => u.id === session.userId);
  if (updated) setSession(updated);
}
