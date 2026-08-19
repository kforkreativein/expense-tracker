-- Money Buddy — run this in Supabase Dashboard → SQL Editor → New query → Run

-- Profiles (linked to Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null default '',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Transactions
create table if not exists public.transactions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'investment')),
  amount integer not null,
  description text default '',
  payment_mode text,
  bank text,
  wallet_id text,
  category_id text,
  spend_category_id text,
  date date not null,
  created_at bigint not null,
  recurring_rule_id text,
  subscription_id text,
  primary key (user_id, id)
);

alter table public.transactions enable row level security;
create policy "transactions_all_own" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Wallets
create table if not exists public.wallets (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default '💳',
  opening_balance numeric,
  min_balance numeric,
  is_credit_card boolean not null default false,
  credit_limit numeric,
  statement_day integer,
  due_day integer,
  primary key (user_id, id)
);

alter table public.wallets enable row level security;
create policy "wallets_all_own" on public.wallets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Categories
create table if not exists public.categories (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default '🏷️',
  budget integer not null default 0,
  wallet_id text,
  primary key (user_id, id)
);

alter table public.categories enable row level security;
create policy "categories_all_own" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Spending categories (Food, Transport, Shopping…) — separate from `categories`,
-- which the app shows as "Type" (Personal / Business / Savings)
create table if not exists public.spend_categories (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default '🏷️',
  budget integer not null default 0,
  primary key (user_id, id)
);

alter table public.spend_categories enable row level security;
create policy "spend_categories_all_own" on public.spend_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Wallet transfers (the table name is retained for existing installations)
create table if not exists public.category_transfers (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  from_category_id text,
  to_category_id text,
  from_wallet_id text not null,
  to_wallet_id text not null,
  note text,
  date date not null,
  created_at bigint not null,
  expense_txn_id text,
  income_txn_id text,
  primary key (user_id, id)
);

alter table public.category_transfers enable row level security;
create policy "transfers_all_own" on public.category_transfers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Recurring rules
-- Legacy — replaced by public.subscriptions below. Kept only so old rows
-- still migrate correctly on a device that hasn't opened the app in a while.
create table if not exists public.recurring_rules (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  amount integer not null,
  description text default '',
  wallet_id text not null,
  category_id text,
  frequency text not null,
  next_due date not null,
  linked_transaction_id text,
  primary key (user_id, id)
);

alter table public.recurring_rules enable row level security;
create policy "recurring_all_own" on public.recurring_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Subscriptions — renewal tracker that can also auto-add a transaction each
-- billing cycle (type + wallet_id set). Replaces recurring_rules.
create table if not exists public.subscriptions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount integer not null,
  currency text not null default 'INR',
  cycle text not null default 'monthly',
  list text not null default 'personal',
  category text not null default 'other',
  first_payment date not null,
  next_payment date not null,
  duration text not null default 'forever',
  free_trial boolean not null default false,
  notify_days_before integer not null default 1,
  emoji text not null default '💳',
  color text not null default '#7C3AED',
  cancelled boolean not null default false,
  subscribed_at date not null,
  history jsonb not null default '[]',
  type text,
  wallet_id text,
  category_id text,
  created_at bigint not null,
  primary key (user_id, id)
);

alter table public.subscriptions enable row level security;
create policy "subscriptions_all_own" on public.subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Split groups (entries stored as JSON — mirrors localStorage shape)
create table if not exists public.split_groups (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  members jsonb not null default '[]',
  former_members jsonb not null default '[]',
  opening_balances jsonb not null default '{}',
  entries jsonb not null default '[]',
  settled boolean not null default false,
  settled_at bigint,
  created_at bigint not null,
  pinned boolean not null default false,
  primary key (user_id, id)
);

alter table public.split_groups enable row level security;
create policy "splits_all_own" on public.split_groups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Savings goal (one row per user)
create table if not exists public.savings_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target integer not null,
  label text not null default 'My Savings Goal'
);

alter table public.savings_goals enable row level security;
create policy "goals_all_own" on public.savings_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- User settings
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_budget integer not null default 0,
  onboarding_done boolean not null default false,
  streak_count integer not null default 0,
  last_visit_date text,
  wallet_order text,
  notifications_enabled boolean not null default false,
  credit_cards_enabled boolean not null default false,
  split_enabled boolean not null default false,
  cc_reminders_dismissed jsonb not null default '[]',
  cc_reminders_notified jsonb not null default '[]'
);

alter table public.user_settings enable row level security;
create policy "settings_all_own" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Migration: run this block if the database was created before credit cards & splits ──
alter table public.wallets add column if not exists is_credit_card boolean not null default false;
alter table public.wallets add column if not exists credit_limit numeric;
alter table public.wallets add column if not exists statement_day integer;
alter table public.wallets add column if not exists due_day integer;
alter table public.user_settings add column if not exists credit_cards_enabled boolean not null default false;
alter table public.user_settings add column if not exists split_enabled boolean not null default false;
alter table public.split_groups add column if not exists former_members jsonb not null default '[]';
alter table public.split_groups add column if not exists opening_balances jsonb not null default '{}';
alter table public.user_settings add column if not exists cc_reminders_dismissed jsonb not null default '[]';
alter table public.user_settings add column if not exists cc_reminders_notified jsonb not null default '[]';
alter table public.transactions add column if not exists spend_category_id text;
