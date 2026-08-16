import { SpendCategory } from './types';
import { userStorageKey } from './auth';
import { scheduleCloudSync } from './supabase/sync';

const KEY = 'money_buddy_spend_categories';

function storageKey() {
  return userStorageKey(KEY);
}

export const DEFAULT_SPEND_CATEGORIES: SpendCategory[] = [
  { id: 'sc_food', name: 'Food', emoji: '🍔', budget: 0 },
  { id: 'sc_transport', name: 'Transport', emoji: '🚗', budget: 0 },
  { id: 'sc_groceries', name: 'Groceries', emoji: '🛒', budget: 0 },
  { id: 'sc_shopping', name: 'Shopping', emoji: '👕', budget: 0 },
  { id: 'sc_home', name: 'Home', emoji: '🏠', budget: 0 },
  { id: 'sc_bills', name: 'Bills', emoji: '⚡', budget: 0 },
  { id: 'sc_health', name: 'Health', emoji: '💊', budget: 0 },
  { id: 'sc_fun', name: 'Fun', emoji: '🎬', budget: 0 },
  { id: 'sc_travel', name: 'Travel', emoji: '✈️', budget: 0 },
  { id: 'sc_gifts', name: 'Gifts', emoji: '🎁', budget: 0 },
  { id: 'sc_other', name: 'Other', emoji: '🏷️', budget: 0 },
];

/**
 * Extra words that should resolve to a category when spoken out loud. Kept here
 * so both the voice parser hint and the local fallback matcher stay in sync.
 */
const ALIASES: Record<string, string[]> = {
  sc_food: ['chai', 'tea', 'coffee', 'breakfast', 'lunch', 'dinner', 'snack', 'restaurant', 'hotel', 'zomato', 'swiggy', 'khana', 'nashta'],
  sc_transport: ['auto', 'rickshaw', 'uber', 'ola', 'cab', 'taxi', 'petrol', 'diesel', 'fuel', 'bus', 'train', 'metro', 'parking'],
  sc_groceries: ['sabzi', 'vegetables', 'kirana', 'blinkit', 'zepto', 'bigbasket', 'milk', 'doodh', 'ration'],
  sc_shopping: ['clothes', 'kapde', 'shoes', 'amazon', 'flipkart', 'myntra'],
  sc_home: ['rent', 'kiraya', 'repair', 'maid', 'furniture'],
  sc_bills: ['bill', 'electricity', 'bijli', 'water', 'recharge', 'internet', 'wifi', 'mobile', 'gas', 'subscription'],
  sc_health: ['medicine', 'dawai', 'doctor', 'hospital', 'gym', 'chemist', 'pharmacy'],
  sc_fun: ['movie', 'cinema', 'game', 'party', 'outing', 'netflix', 'spotify'],
  sc_travel: ['flight', 'trip', 'holiday', 'vacation', 'hotel booking', 'ticket'],
  sc_gifts: ['gift', 'present', 'donation', 'shagun'],
};

export function getSpendCategories(): SpendCategory[] {
  if (typeof window === 'undefined') return DEFAULT_SPEND_CATEGORIES;
  const raw = localStorage.getItem(storageKey());
  // A missing key means "never set up"; an empty array means the user deleted them all.
  if (raw == null) {
    localStorage.setItem(storageKey(), JSON.stringify(DEFAULT_SPEND_CATEGORIES));
    return DEFAULT_SPEND_CATEGORIES;
  }
  try {
    const parsed = JSON.parse(raw) as SpendCategory[];
    if (!Array.isArray(parsed)) return DEFAULT_SPEND_CATEGORIES;
    return parsed.map(c => ({ ...c, budget: c.budget ?? 0 }));
  } catch {
    return DEFAULT_SPEND_CATEGORIES;
  }
}

export function saveSpendCategories(categories: SpendCategory[]) {
  localStorage.setItem(storageKey(), JSON.stringify(categories));
  scheduleCloudSync();
}

export function addSpendCategory(name: string, emoji: string): SpendCategory {
  const cat: SpendCategory = {
    id: crypto.randomUUID(),
    name: name.trim(),
    emoji: emoji || '🏷️',
    budget: 0,
  };
  saveSpendCategories([...getSpendCategories(), cat]);
  return cat;
}

export function updateSpendCategory(id: string, patch: Partial<Pick<SpendCategory, 'name' | 'emoji' | 'budget'>>) {
  const updated = getSpendCategories().map(c => (c.id === id ? { ...c, ...patch } : c));
  saveSpendCategories(updated);
  return updated;
}

export function deleteSpendCategory(id: string) {
  saveSpendCategories(getSpendCategories().filter(c => c.id !== id));
}

export function getSpendCategoryById(id: string): SpendCategory | undefined {
  return getSpendCategories().find(c => c.id === id);
}

/** Restore any built-in category the user still has, without duplicating ids. */
export function restoreDefaultSpendCategories(): SpendCategory[] {
  const existing = getSpendCategories();
  const known = new Set(existing.map(c => c.id));
  const missing = DEFAULT_SPEND_CATEGORIES.filter(c => !known.has(c.id));
  if (!missing.length) return existing;
  const next = [...existing, ...missing];
  saveSpendCategories(next);
  return next;
}

/**
 * Best-effort text match, used when the voice parser returns a spoken name
 * instead of one of the ids it was given.
 */
export function matchSpendCategory(text: string, categories: SpendCategory[]): SpendCategory | undefined {
  const q = text.trim().toLowerCase();
  if (!q) return undefined;

  const byName = categories.find(c => c.name.toLowerCase() === q);
  if (byName) return byName;

  const byId = categories.find(c => c.id.toLowerCase() === q);
  if (byId) return byId;

  const partial = categories.find(c => q.includes(c.name.toLowerCase()));
  if (partial) return partial;

  for (const [id, words] of Object.entries(ALIASES)) {
    if (!words.some(w => q.includes(w))) continue;
    const hit = categories.find(c => c.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** Short "Food (chai, lunch), Transport (auto, uber)" hint for the voice parser. */
export function spendCategoryHints(categories: SpendCategory[]): string {
  return categories
    .map(c => {
      const words = ALIASES[c.id]?.slice(0, 5);
      return words?.length ? `${c.name} (${words.join(', ')})` : c.name;
    })
    .join('; ');
}
