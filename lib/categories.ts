import { Category, Wallet } from './types';
import { userStorageKey } from './auth';
import { scheduleCloudSync } from './supabase/sync';

const KEY = 'money_buddy_categories';

function storageKey() {
  return userStorageKey(KEY);
}

export function getCategories(): Category[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey()) ?? '[]');
  } catch {
    return [];
  }
}

function save(categories: Category[]) {
  localStorage.setItem(storageKey(), JSON.stringify(categories));
  scheduleCloudSync();
}

export function addCategory(name: string, emoji: string): Category {
  const cat: Category = {
    id: crypto.randomUUID(),
    name: name.trim(),
    emoji: emoji || '🏷️',
    budget: 0,
  };
  save([...getCategories(), cat]);
  return cat;
}

export function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'emoji' | 'budget' | 'walletId'>>) {
  const updated = getCategories().map(c => c.id === id ? { ...c, ...patch } : c);
  save(updated);
  return updated;
}

export function deleteCategory(id: string) {
  save(getCategories().filter(c => c.id !== id));
}

export function getCategoryById(id: string): Category | undefined {
  return getCategories().find(c => c.id === id);
}

export function findCategoryByKeyword(categories: Category[], keyword: string): Category | undefined {
  const k = keyword.toLowerCase();
  return categories.find(c => c.name.toLowerCase().includes(k));
}

/**
 * Legacy categories did not store a wallet. Give the three built-in views a
 * useful suggestion until the user explicitly picks a different default in
 * Settings. Explicit category wallet choices always win.
 */
export function suggestedWalletForCategory(category: Category, wallets: Wallet[]): string | undefined {
  if (category.walletId && wallets.some(wallet => wallet.id === category.walletId)) return category.walletId;

  const name = category.name.trim().toLowerCase();
  const matchByName = (needle: string) => {
    const hit = (wallet: Wallet) => `${wallet.id} ${wallet.name}`.toLowerCase().includes(needle);
    const bank = wallets.find(wallet => hit(wallet) && !wallet.isCreditCard);
    if (bank) return bank.id;
    return wallets.find(hit)?.id;
  };

  if (name.includes('saving')) return matchByName('hdfc') ?? matchByName('saving');
  if (name.includes('business')) return matchByName('idfc') ?? matchByName('business');
  if (name.includes('personal')) return matchByName('yes') ?? matchByName('personal');
  return undefined;
}
