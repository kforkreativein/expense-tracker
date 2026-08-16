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
 * Words that should resolve to a category, whether typed or spoken. Kept here so
 * the form, the voice parser hint and the fallback matcher all stay in sync.
 */
const ALIASES: Record<string, string[]> = {
  sc_food: [
    'chai', 'tea', 'coffee', 'cafe', 'breakfast', 'lunch', 'dinner', 'brunch', 'snack', 'snacks',
    'restaurant', 'zomato', 'swiggy', 'eatsure', 'dominos', 'pizza', 'burger', 'mcd', 'mcdonalds',
    'kfc', 'starbucks', 'biryani', 'thali', 'canteen', 'tiffin', 'khana', 'nashta',
    'juice', 'icecream', 'dessert', 'bakery', 'samosa', 'food',
  ],
  sc_transport: [
    'auto', 'rickshaw', 'uber', 'ola', 'rapido', 'cab', 'taxi', 'petrol', 'diesel', 'fuel', 'cng',
    'bus', 'train', 'metro', 'parking', 'toll', 'yulu', 'scooter', 'bike', 'ride', 'travel card',
    'transport', 'commute',
  ],
  sc_groceries: [
    'sabzi', 'sabji', 'vegetables', 'veggies', 'kirana', 'blinkit', 'zepto', 'instamart',
    'bigbasket', 'dmart', 'jiomart', 'milk', 'doodh', 'ration', 'atta', 'grocery', 'groceries',
    'supermarket',
  ],
  sc_shopping: [
    'clothes', 'kapde', 'shirt', 'jeans', 'shoes', 'amazon', 'flipkart', 'myntra', 'ajio',
    'meesho', 'nykaa', 'watch', 'bag', 'shopping',
  ],
  sc_home: [
    'rent', 'kiraya', 'repair', 'plumber', 'electrician', 'maid', 'bai', 'furniture', 'decor',
    'society', 'maintenance', 'cleaning', 'home',
  ],
  sc_bills: [
    'bill', 'bills', 'electricity', 'bijli', 'water', 'recharge', 'internet', 'wifi', 'broadband',
    'jio', 'airtel', 'vodafone', 'postpaid', 'prepaid', 'dth', 'gas', 'cylinder', 'subscription',
    'insurance', 'premium',
  ],
  sc_health: [
    'medicine', 'medicines', 'dawai', 'doctor', 'hospital', 'clinic', 'dentist', 'gym', 'chemist',
    'pharmacy', 'apollo', 'checkup', 'lab', 'therapy', 'health',
  ],
  sc_fun: [
    'movie', 'movies', 'cinema', 'pvr', 'inox', 'bookmyshow', 'game', 'gaming', 'party', 'outing',
    'netflix', 'spotify', 'hotstar', 'prime', 'concert', 'club', 'fun',
  ],
  sc_travel: [
    'flight', 'flights', 'trip', 'holiday', 'vacation', 'irctc', 'makemytrip', 'goibibo', 'oyo',
    'airbnb', 'hotel', 'resort', 'booking', 'visa', 'luggage',
  ],
  sc_gifts: ['gift', 'gifts', 'present', 'donation', 'charity', 'shagun', 'birthday', 'anniversary'],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word match, so "gift" does not fire on "gifted a" style false friends and
 * short words like "gas" never match inside "gaskets".
 */
function mentions(text: string, word: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(word)}([^\\p{L}\\p{N}]|$)`, 'iu').test(text);
}

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
 * Works out the category from free text — a typed note like "Zomato dinner" or a
 * spoken phrase. Also used when the voice parser hands back a name instead of one
 * of the ids it was given.
 */
export function matchSpendCategory(text: string, categories: SpendCategory[]): SpendCategory | undefined {
  const q = text.trim().toLowerCase();
  if (!q) return undefined;

  const byName = categories.find(c => c.name.toLowerCase() === q);
  if (byName) return byName;

  const byId = categories.find(c => c.id.toLowerCase() === q);
  if (byId) return byId;

  // A category the user named themselves should win over any built-in alias
  const named = categories.find(c => mentions(q, c.name.toLowerCase()));
  if (named) return named;

  for (const category of categories) {
    const words = ALIASES[category.id];
    if (words?.some(word => mentions(q, word))) return category;
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
