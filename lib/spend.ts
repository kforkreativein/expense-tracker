export interface SpendTag {
  id: string;
  emoji: string;
  label: string;
  keys: string[];
}

export const SPEND_TAGS: SpendTag[] = [
  { id: 'food', emoji: '🍔', label: 'Food', keys: ['food', 'lunch', 'dinner', 'breakfast', 'snack', 'swiggy', 'zomato', 'restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'meal'] },
  { id: 'groceries', emoji: '🛒', label: 'Groceries', keys: ['grocery', 'groceries', 'supermarket', 'kirana', 'vegetables', 'fruit'] },
  { id: 'transport', emoji: '🚗', label: 'Transport', keys: ['uber', 'ola', 'petrol', 'diesel', 'fuel', 'metro', 'auto', 'taxi', 'parking', 'transport', 'bus', 'train', 'rapido'] },
  { id: 'shopping', emoji: '👕', label: 'Shopping', keys: ['shopping', 'amazon', 'flipkart', 'myntra', 'clothes', 'amazon'] },
  { id: 'bills', emoji: '💡', label: 'Bills', keys: ['bill', 'electricity', 'wifi', 'recharge', 'mobile', 'rent', 'subscription'] },
  { id: 'health', emoji: '💊', label: 'Health', keys: ['medicine', 'pharmacy', 'doctor', 'hospital', 'clinic', 'health'] },
  { id: 'fun', emoji: '🎬', label: 'Fun', keys: ['movie', 'netflix', 'game', 'party', 'outing'] },
];

export function guessSpendTag(text: string): string {
  const hay = text.toLowerCase();
  if (!hay.trim()) return '';
  for (const tag of SPEND_TAGS) {
    if (tag.keys.some(key => hay.includes(key))) return tag.id;
  }
  return '';
}

export function spendTagById(id: string | undefined): SpendTag | undefined {
  if (!id) return undefined;
  return SPEND_TAGS.find(tag => tag.id === id);
}
