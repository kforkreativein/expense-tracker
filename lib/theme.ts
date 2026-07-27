import { userStorageKey } from './auth';

export type Theme = 'light' | 'dark';

const KEY = 'money_buddy_theme';

function storageKey() {
  return userStorageKey(KEY);
}

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return localStorage.getItem(storageKey()) === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const color = theme === 'dark' ? '#171717' : '#FFF7ED';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

export function setTheme(theme: Theme) {
  localStorage.setItem(storageKey(), theme);
  applyTheme(theme);
}
