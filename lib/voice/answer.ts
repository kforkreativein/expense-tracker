import { Category, SpendCategory, Transaction, Wallet, WalletTransfer } from '../types';
import { legacyWalletId } from '../wallets';
import { getInternalTransferTxnIds, isInternalTransferTxn } from '../transfers';
import { ParsedQuery, QueryPeriod } from './types';

export interface VoiceAnswer {
  /** "Spent on Food" */
  title: string;
  /** "this month" */
  periodLabel: string;
  amount: number;
  count: number;
  /** Matching entries, newest first */
  transactions: Transaction[];
  /** Present when a monthly limit applies to the asked-about category */
  limit: number | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function toIso(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function monthName(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

interface Range {
  start: string | null;
  end: string | null;
  label: string;
}

export function resolvePeriod(period: QueryPeriod, now = new Date()): Range {
  const offset = Math.max(-60, Math.min(0, Math.round(period.offset || 0)));

  switch (period.kind) {
    case 'today': {
      const iso = toIso(now);
      return { start: iso, end: iso, label: 'today' };
    }
    case 'yesterday': {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const iso = toIso(d);
      return { start: iso, end: iso, label: 'yesterday' };
    }
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + offset * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        start: toIso(start),
        end: toIso(end),
        label: offset === 0 ? 'this week' : offset === -1 ? 'last week' : `${Math.abs(offset)} weeks ago`,
      };
    }
    case 'year': {
      const year = now.getFullYear() + offset;
      return {
        start: `${year}-01-01`,
        end: `${year}-12-31`,
        label: offset === 0 ? 'this year' : String(year),
      };
    }
    case 'range': {
      if (period.start && period.end && ISO.test(period.start) && ISO.test(period.end)) {
        const [start, end] = period.start <= period.end
          ? [period.start, period.end]
          : [period.end, period.start];
        return { start, end, label: `${fmtDay(start)} – ${fmtDay(end)}` };
      }
      // Fall back to the current month when the dates were not usable
      return resolvePeriod({ kind: 'month', offset: 0, start: null, end: null }, now);
    }
    case 'all':
      return { start: null, end: null, label: 'all time' };
    case 'month':
    default: {
      const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
      return {
        start: toIso(first),
        end: toIso(last),
        label: offset === 0 ? 'this month' : offset === -1 ? 'last month' : monthName(first),
      };
    }
  }
}

function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

interface AnswerInput {
  query: ParsedQuery;
  transactions: Transaction[];
  transfers: WalletTransfer[];
  wallets: Wallet[];
  types: Category[];
  spendCategories: SpendCategory[];
  now?: Date;
}

/**
 * Answers a spoken question from the data already on the device. Nothing about
 * the user's amounts is ever sent anywhere to produce this.
 */
export function answerQuery({
  query,
  transactions,
  transfers,
  wallets,
  types,
  spendCategories,
  now = new Date(),
}: AnswerInput): VoiceAnswer {
  const range = resolvePeriod(query.period, now);
  const transferIds = getInternalTransferTxnIds(transfers);

  const spendCategory = query.spendCategoryId
    ? spendCategories.find(c => c.id === query.spendCategoryId)
    : undefined;
  const type = query.typeId ? types.find(c => c.id === query.typeId) : undefined;
  const wallet = query.walletId ? wallets.find(w => w.id === query.walletId) : undefined;

  const inRange = (t: Transaction) =>
    (!range.start || t.date >= range.start) && (!range.end || t.date <= range.end);

  const matches = transactions.filter(t => {
    if (!inRange(t)) return false;
    if (isInternalTransferTxn(t, transferIds)) return false;
    if (spendCategory && t.spendCategoryId !== spendCategory.id) return false;
    if (type && t.categoryId !== type.id) return false;
    if (wallet && (t.walletId ?? legacyWalletId(t.paymentMode, t.bank)) !== wallet.id) return false;
    if (query.metric !== 'net' && t.type !== query.metric) return false;
    return true;
  });

  const amount = query.metric === 'net'
    ? matches.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0)
    : matches.reduce((sum, t) => sum + t.amount, 0);

  const parts: string[] = [];
  if (query.metric === 'expense') parts.push('Spent');
  else if (query.metric === 'income') parts.push('Received');
  else if (query.metric === 'investment') parts.push('Invested');
  else parts.push('Left over');

  if (spendCategory) parts.push(`on ${spendCategory.emoji} ${spendCategory.name}`);
  if (type) parts.push(`in ${type.emoji} ${type.name}`);
  if (wallet) parts.push(`from ${wallet.emoji} ${wallet.name}`);

  const limit = spendCategory && spendCategory.budget > 0 && query.period.kind === 'month' && query.metric === 'expense'
    ? spendCategory.budget
    : null;

  return {
    title: parts.join(' '),
    periodLabel: range.label,
    amount,
    count: matches.length,
    transactions: [...matches].sort((a, b) =>
      b.date !== a.date ? b.date.localeCompare(a.date) : b.createdAt - a.createdAt,
    ),
    limit,
  };
}
