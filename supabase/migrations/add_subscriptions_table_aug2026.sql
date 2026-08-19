-- Money Buddy — subscriptions now fully replace recurring rules.
-- Subscriptions can optionally auto-add a transaction each billing cycle
-- (type + wallet_id set) or stay a renewal reminder only (left null).
--
-- Run this in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to run more than once. The old recurring_rules table is left in
-- place (unused going forward) — nothing here deletes it.

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

drop policy if exists "subscriptions_all_own" on public.subscriptions;
create policy "subscriptions_all_own" on public.subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Links a transaction back to the subscription that auto-added it
alter table public.transactions add column if not exists subscription_id text;
