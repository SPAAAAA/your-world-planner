-- ============================================================
-- Migration: adds the Clients feature (clients + client_updates tables).
-- Run this once in Supabase SQL Editor.
-- ============================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_number int not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  address text,
  city text,
  state text,
  postal_code text,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

drop policy if exists "clients owner select" on public.clients;
drop policy if exists "clients owner insert" on public.clients;
drop policy if exists "clients owner update" on public.clients;
drop policy if exists "clients owner delete" on public.clients;

create policy "clients owner select" on public.clients for select using (auth.uid() = user_id);
create policy "clients owner insert" on public.clients for insert with check (auth.uid() = user_id);
create policy "clients owner update" on public.clients for update using (auth.uid() = user_id);
create policy "clients owner delete" on public.clients for delete using (auth.uid() = user_id);

create index if not exists clients_user_idx on public.clients (user_id, client_number);
create unique index if not exists clients_user_number_unique on public.clients (user_id, client_number);

create table if not exists public.client_updates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.client_updates enable row level security;

drop policy if exists "client_updates owner select" on public.client_updates;
drop policy if exists "client_updates owner insert" on public.client_updates;
drop policy if exists "client_updates owner update" on public.client_updates;
drop policy if exists "client_updates owner delete" on public.client_updates;

create policy "client_updates owner select" on public.client_updates for select using (auth.uid() = user_id);
create policy "client_updates owner insert" on public.client_updates for insert with check (auth.uid() = user_id);
create policy "client_updates owner update" on public.client_updates for update using (auth.uid() = user_id);
create policy "client_updates owner delete" on public.client_updates for delete using (auth.uid() = user_id);

create index if not exists client_updates_client_idx on public.client_updates (client_id, created_at desc);
