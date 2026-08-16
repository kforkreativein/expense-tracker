import { userStorageKey } from './auth';
import { scheduleCloudSync } from './supabase/sync';

const KEY = 'money_buddy_streak';
const POPUP_KEY = 'money_buddy_streak_popup';

export interface StreakData {
  streak: number;
  lastVisitDate: string;
}

/** Local calendar date (YYYY-MM-DD) — never UTC, so IST midnight does not reset the streak. */
function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

function storageKey() {
  return userStorageKey(KEY);
}

function popupKey() {
  return userStorageKey(POPUP_KEY);
}

export function getStreakData(): StreakData {
  if (typeof window === 'undefined') return { streak: 0, lastVisitDate: '' };
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return { streak: 0, lastVisitDate: '' };
    return JSON.parse(raw) as StreakData;
  } catch {
    return { streak: 0, lastVisitDate: '' };
  }
}

function saveStreak(data: StreakData) {
  localStorage.setItem(storageKey(), JSON.stringify(data));
  scheduleCloudSync();
}

/**
 * Call once when the app loads after auth. Increments streak on the first visit
 * of each local calendar day. Popup shows at most once per day.
 */
export function recordDailyVisit(): { streak: number; previousStreak: number; isFirstVisitToday: boolean } {
  const today = localDateStr();
  const current = getStreakData();

  if (current.lastVisitDate === today) {
    // Already counted today — never pop the streak card again this day
    return {
      streak: Math.max(0, current.streak),
      previousStreak: current.streak,
      isFirstVisitToday: false,
    };
  }

  const continued = current.lastVisitDate === yesterdayStr();
  const previousStreak = continued ? current.streak : 0;
  const streak = continued ? current.streak + 1 : 1;
  saveStreak({ streak, lastVisitDate: today });
  localStorage.setItem(popupKey(), today);
  return { streak, previousStreak, isFirstVisitToday: true };
}

/** Mark the daily streak popup as already shown (e.g. user dismissed it). */
export function markStreakPopupSeen() {
  localStorage.setItem(popupKey(), localDateStr());
}

export function getStreak(): number {
  return getStreakData().streak;
}

export function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Prefer the fresher visit date when merging cloud + local streak. */
export function mergeStreakFromCloud(cloud: { streak: number; lastVisitDate: string }): StreakData {
  const local = getStreakData();
  const cloudDate = cloud.lastVisitDate || '';
  const localDate = local.lastVisitDate || '';
  if (cloudDate > localDate) {
    const next = { streak: cloud.streak || 0, lastVisitDate: cloudDate };
    saveStreak(next);
    return next;
  }
  if (localDate > cloudDate) return local;
  // Same day (or both empty) — keep the higher count
  const next = {
    streak: Math.max(local.streak, cloud.streak || 0),
    lastVisitDate: localDate || cloudDate,
  };
  saveStreak(next);
  return next;
}
