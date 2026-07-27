-- Run in the Supabase SQL Editor for databases created before wallet transfers.
-- Legacy category columns are intentionally retained so historical data can be migrated locally.
alter table public.category_transfers add column if not exists from_wallet_id text;
alter table public.category_transfers add column if not exists to_wallet_id text;
alter table public.category_transfers alter column from_category_id drop not null;
alter table public.category_transfers alter column to_category_id drop not null;
