-- Money Buddy — spending categories (Food, Transport, Shopping…)
-- These are separate from `categories`, which the app now shows as "Type"
-- (Personal / Business / Savings / Investment) and uses for the view switcher.
--
-- Run this in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to run more than once.

create table if not exists public.spend_categories (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default '🏷️',
  budget integer not null default 0,
  primary key (user_id, id)
);

alter table public.spend_categories enable row level security;

drop policy if exists "spend_categories_all_own" on public.spend_categories;
create policy "spend_categories_all_own" on public.spend_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Which spending category an entry belongs to
alter table public.transactions add column if not exists spend_category_id text;
