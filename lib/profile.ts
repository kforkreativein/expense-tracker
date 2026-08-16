import { userStorageKey } from './auth';
import { scheduleCloudSync } from './supabase/sync';

export interface UserProfile {
  age: string;
  currency: string;
  monthlyIncome: string;
  upiId: string;
  email: string;
  reminders: {
    daily: boolean;
    weekly: boolean;
    biMonthly: boolean;
    monthly: boolean;
    subscription: boolean;
  };
}

const KEY = 'money_buddy_profile';

const DEFAULTS: UserProfile = {
  age: '',
  currency: 'INR Indian Rupee',
  monthlyIncome: '',
  upiId: '',
  email: '',
  reminders: {
    daily: true,
    weekly: true,
    biMonthly: false,
    monthly: true,
    subscription: true,
  },
};

function storageKey() {
  return userStorageKey(KEY);
}

export function getProfile(): UserProfile {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return { ...DEFAULTS, reminders: { ...DEFAULTS.reminders } };
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      ...DEFAULTS,
      ...parsed,
      reminders: { ...DEFAULTS.reminders, ...(parsed.reminders ?? {}) },
    };
  } catch {
    return { ...DEFAULTS, reminders: { ...DEFAULTS.reminders } };
  }
}

export function saveProfile(patch: Partial<UserProfile>) {
  const next = { ...getProfile(), ...patch, reminders: { ...getProfile().reminders, ...(patch.reminders ?? {}) } };
  localStorage.setItem(storageKey(), JSON.stringify(next));
  scheduleCloudSync();
  return next;
}
