/** Shapes shared by the browser and the /api/voice route. */

export type VoiceIntent = 'entries' | 'query' | 'unclear';

export interface VoiceContextItem {
  id: string;
  name: string;
}

/**
 * Everything the parser is allowed to know. Only names and ids are sent — no
 * amounts, balances or history ever leave the device.
 */
export interface VoiceContext {
  /** Today on the user's device, YYYY-MM-DD */
  today: string;
  wallets: VoiceContextItem[];
  types: VoiceContextItem[];
  spendCategories: VoiceContextItem[];
  /** "Food (chai, lunch); Transport (auto, uber)" — helps match spoken words */
  spendCategoryHints: string;
  defaultWalletId: string | null;
  defaultTypeId: string | null;
}

export interface ParsedEntry {
  txType: 'income' | 'expense' | 'investment';
  amount: number;
  description: string;
  walletId: string | null;
  typeId: string | null;
  spendCategoryId: string | null;
  /** YYYY-MM-DD */
  date: string;
}

export type QueryMetric = 'expense' | 'income' | 'investment' | 'net';

export type QueryPeriodKind = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'range' | 'all';

export interface QueryPeriod {
  kind: QueryPeriodKind;
  /** 0 = current, -1 = previous, and so on. Ignored for today/range/all. */
  offset: number;
  /** Only for kind 'range' */
  start: string | null;
  end: string | null;
}

export interface ParsedQuery {
  metric: QueryMetric;
  spendCategoryId: string | null;
  typeId: string | null;
  walletId: string | null;
  period: QueryPeriod;
}

export interface VoiceResult {
  transcript: string;
  intent: VoiceIntent;
  entries: ParsedEntry[];
  query: ParsedQuery | null;
  /** Short human-readable note when something could not be understood */
  note: string;
}

export interface VoiceErrorResult {
  error: string;
  /** Machine-readable reason so the UI can react (e.g. ask to log in again) */
  code:
    | 'not_configured'
    | 'unauthorized'
    | 'too_large'
    | 'rate_limited'
    | 'bad_request'
    | 'upstream'
    | 'server';
}
