export type TxType = 'income' | 'expense' | 'investment';
export type PaymentMode = 'gpay' | 'cash';
export type Bank = 'yes_bank' | 'hdfc';
export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface Wallet {
  id: string;
  name: string;
  emoji: string;
  openingBalance?: number;
  minBalance?: number;
  isCreditCard?: boolean;
  creditLimit?: number;
  /** Day of month (1-31) the CC statement is generated */
  statementDay?: number;
  /** Day of month (1-31) the CC bill is due */
  dueDay?: number;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  budget: number;
  /** Wallet used for this category — category transfers move money between linked wallets */
  walletId?: string;
}

/** @deprecated use Category */
export type ExpenseCategory = Category;

/** A movement of money between two wallets. It is excluded from income and expense totals. */
export interface WalletTransfer {
  id: string;
  amount: number;
  fromWalletId: string;
  toWalletId: string;
  note?: string;
  date: string;
  createdAt: number;
  expenseTxnId?: string;
  incomeTxnId?: string;
  /** Kept only while reading pre-wallet-transfer records. */
  fromCategoryId?: string;
  /** Kept only while reading pre-wallet-transfer records. */
  toCategoryId?: string;
}

/** @deprecated use WalletTransfer */
export type CategoryTransfer = WalletTransfer;

export interface SavingsGoal {
  target: number;
  label: string;
}

export interface RecurringRule {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  walletId: string;
  categoryId?: string;
  frequency: Frequency;
  nextDue: string;
  /** Transaction that created this rule (for edit screen) */
  linkedTransactionId?: string;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  paymentMode: PaymentMode;
  bank?: Bank;
  walletId?: string;
  categoryId?: string;
  recurringRuleId?: string;
  date: string;
  createdAt: number;
}

export interface SplitEntry {
  id: string;
  description: string;
  totalAmount: number;
  paidBy: 'me' | string;
  splitAmong: string[]; // 'me' or member names
  /** Custom share per person (₹ amounts, keys from splitAmong). Absent = equal split. */
  shares?: Record<string, number>;
  date: string;
  createdAt: number;
  linkedTransactionId?: string;
  isSettlement?: boolean;
  /** Settlement recorded as "let it go" — balance cleared without any money moving */
  isForgiven?: boolean;
}

export interface SplitGroup {
  id: string;
  name: string;
  members: string[]; // other people's names (not 'me')
  /** Members removed from the group (kept for history display) */
  formerMembers?: string[];
  /** Pending opening balance per member: positive = they owe me (receivable), negative = I owe them */
  openingBalances?: Record<string, number>;
  entries: SplitEntry[];
  settled: boolean;
  settledAt?: number;
  createdAt: number;
  pinned?: boolean;
}
