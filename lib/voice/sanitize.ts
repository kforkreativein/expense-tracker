import { Category, SpendCategory, Transaction, Wallet } from '../types';
import { walletToPaymentMode } from '../wallets';
import { matchSpendCategory } from '../spendCategories';
import { ParsedEntry } from './types';

const MAX_AMOUNT = 10_000_000;

interface Lists {
  wallets: Wallet[];
  types: Category[];
  spendCategories: SpendCategory[];
  fallbackWalletId: string | null;
  fallbackTypeId: string | null;
}

function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Never trust a spoken date: no future entries, nothing absurdly old. */
function safeDate(value: string): string {
  const today = todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return today;

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return today;
  if (value > today) return today;

  const floor = new Date();
  floor.setFullYear(floor.getFullYear() - 5);
  if (parsed < floor) return today;

  return value;
}

function resolveWalletId(spoken: string | null, lists: Lists): string {
  if (spoken) {
    const byId = lists.wallets.find(w => w.id === spoken);
    if (byId) return byId.id;
    const byName = lists.wallets.find(w => w.name.toLowerCase() === spoken.trim().toLowerCase());
    if (byName) return byName.id;
    const partial = lists.wallets.find(w => spoken.toLowerCase().includes(w.name.toLowerCase()));
    if (partial) return partial.id;
  }
  if (lists.fallbackWalletId && lists.wallets.some(w => w.id === lists.fallbackWalletId)) {
    return lists.fallbackWalletId;
  }
  return lists.wallets[0]?.id ?? '';
}

function resolveTypeId(spoken: string | null, lists: Lists): string | undefined {
  if (spoken) {
    const byId = lists.types.find(c => c.id === spoken);
    if (byId) return byId.id;
    const byName = lists.types.find(c => c.name.toLowerCase() === spoken.trim().toLowerCase());
    if (byName) return byName.id;
  }
  if (lists.fallbackTypeId && lists.types.some(c => c.id === lists.fallbackTypeId)) {
    return lists.fallbackTypeId;
  }
  return undefined;
}

function resolveSpendCategoryId(
  spoken: string | null,
  description: string,
  lists: Lists,
): string | undefined {
  if (spoken) {
    const byId = lists.spendCategories.find(c => c.id === spoken);
    if (byId) return byId.id;
    const matched = matchSpendCategory(spoken, lists.spendCategories);
    if (matched) return matched.id;
  }
  // The parser sometimes leaves this blank even though the note makes it obvious
  return description ? matchSpendCategory(description, lists.spendCategories)?.id : undefined;
}

function cleanDescription(value: string, fallback: string): string {
  const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!trimmed) return fallback;
  // Drop a leading rupee amount the parser may have kept ("500 chai" -> "chai")
  const withoutAmount = trimmed.replace(/^(₹|rs\.?|rupees?)?\s*[\d,]+\s*(rs\.?|rupees?)?\s*/i, '').trim();
  const result = withoutAmount || trimmed;
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Turns parsed speech into savable drafts. Anything the model got wrong is
 * corrected or dropped here, so a bad response can only ever mean "less filled
 * in", never a wrong or unsavable entry.
 */
export function draftsFromParsed(entries: ParsedEntry[], lists: Lists): Transaction[] {
  const drafts: Transaction[] = [];

  for (const entry of entries.slice(0, 10)) {
    const amount = Math.round(Number(entry.amount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) continue;

    const txType = entry.txType === 'income' || entry.txType === 'investment' ? entry.txType : 'expense';
    const walletId = resolveWalletId(entry.walletId, lists);
    const payment = walletToPaymentMode(walletId);
    const spendCategoryId = txType === 'expense'
      ? resolveSpendCategoryId(entry.spendCategoryId, entry.description, lists)
      : undefined;

    const fallbackLabel = spendCategoryId
      ? lists.spendCategories.find(c => c.id === spendCategoryId)?.name ?? 'Voice entry'
      : txType === 'income' ? 'Income' : txType === 'investment' ? 'Investment' : 'Voice entry';

    drafts.push({
      id: crypto.randomUUID(),
      type: txType,
      amount,
      description: cleanDescription(entry.description, fallbackLabel),
      walletId,
      paymentMode: payment.paymentMode,
      bank: payment.bank,
      categoryId: txType === 'investment' ? undefined : resolveTypeId(entry.typeId, lists),
      spendCategoryId,
      date: safeDate(entry.date),
      createdAt: Date.now(),
    });
  }

  return drafts;
}
