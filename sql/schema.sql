-- ============================================================
-- Your World Planner — database schema
-- Run this once in Supabase: Project → SQL Editor → New query
-- ============================================================

-- Profiles: one row per user, created automatically on signup
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles are editable by owner"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Automatically create a profile row whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Plan items: lightweight day-by-day to-dos (separate from Google Calendar events)
create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  title text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.plan_items enable row level security;

create policy "plan_items owner select" on public.plan_items for select using (auth.uid() = user_id);
create policy "plan_items owner insert" on public.plan_items for insert with check (auth.uid() = user_id);
create policy "plan_items owner update" on public.plan_items for update using (auth.uid() = user_id);
create policy "plan_items owner delete" on public.plan_items for delete using (auth.uid() = user_id);

create index if not exists plan_items_user_date_idx on public.plan_items (user_id, plan_date);


-- Notes
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled note',
  content text not null default '',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

create policy "notes owner select" on public.notes for select using (auth.uid() = user_id);
create policy "notes owner insert" on public.notes for insert with check (auth.uid() = user_id);
create policy "notes owner update" on public.notes for update using (auth.uid() = user_id);
create policy "notes owner delete" on public.notes for delete using (auth.uid() = user_id);

create index if not exists notes_user_idx on public.notes (user_id, updated_at desc);


-- Moodboards
create table if not exists public.moodboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'New moodboard',
  created_at timestamptz not null default now()
);

alter table public.moodboards enable row level security;

create policy "moodboards owner select" on public.moodboards for select using (auth.uid() = user_id);
create policy "moodboards owner insert" on public.moodboards for insert with check (auth.uid() = user_id);
create policy "moodboards owner update" on public.moodboards for update using (auth.uid() = user_id);
create policy "moodboards owner delete" on public.moodboards for delete using (auth.uid() = user_id);


-- Moodboard items (images, text, and shapes placed freely on a board)
create table if not exists public.moodboard_items (
  id uuid primary key default gen_random_uuid(),
  moodboard_id uuid not null references public.moodboards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null default 'image', -- 'image' | 'text' | 'box' | 'line' | 'arrow'
  image_path text, -- path inside the moodboard-images storage bucket (image items only)
  content text, -- text content (text items only)
  color text not null default '#d97757', -- text color / shape color
  x double precision not null default 40,
  y double precision not null default 40,
  width double precision not null default 220,
  height double precision not null default 220,
  rotation double precision not null default 0,
  z_index int not null default 1,
  created_at timestamptz not null default now()
);

alter table public.moodboard_items enable row level security;

create policy "moodboard_items owner select" on public.moodboard_items for select using (auth.uid() = user_id);
create policy "moodboard_items owner insert" on public.moodboard_items for insert with check (auth.uid() = user_id);
create policy "moodboard_items owner update" on public.moodboard_items for update using (auth.uid() = user_id);
create policy "moodboard_items owner delete" on public.moodboard_items for delete using (auth.uid() = user_id);

create index if not exists moodboard_items_board_idx on public.moodboard_items (moodboard_id);


-- Clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_number int not null, -- per-user sequential id shown in the UI (1, 2, 3, …)
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

create policy "clients owner select" on public.clients for select using (auth.uid() = user_id);
create policy "clients owner insert" on public.clients for insert with check (auth.uid() = user_id);
create policy "clients owner update" on public.clients for update using (auth.uid() = user_id);
create policy "clients owner delete" on public.clients for delete using (auth.uid() = user_id);

create index if not exists clients_user_idx on public.clients (user_id, client_number);
create unique index if not exists clients_user_number_unique on public.clients (user_id, client_number);


-- Client updates (a running dossier of timestamped notes per client)
create table if not exists public.client_updates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.client_updates enable row level security;

create policy "client_updates owner select" on public.client_updates for select using (auth.uid() = user_id);
create policy "client_updates owner insert" on public.client_updates for insert with check (auth.uid() = user_id);
create policy "client_updates owner update" on public.client_updates for update using (auth.uid() = user_id);
create policy "client_updates owner delete" on public.client_updates for delete using (auth.uid() = user_id);

create index if not exists client_updates_client_idx on public.client_updates (client_id, created_at desc);


-- ============================================================
-- Storage: create a bucket called "moodboard-images" (Storage → New bucket,
-- keep it private/not-public) then run the policies below.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('moodboard-images', 'moodboard-images', false)
on conflict (id) do nothing;

create policy "moodboard images owner select"
  on storage.objects for select
  using (bucket_id = 'moodboard-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "moodboard images owner insert"
  on storage.objects for insert
  with check (bucket_id = 'moodboard-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "moodboard images owner update"
  on storage.objects for update
  using (bucket_id = 'moodboard-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "moodboard images owner delete"
  on storage.objects for delete
  using (bucket_id = 'moodboard-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- Images should be uploaded under a path like: <user_id>/<moodboard_id>/<filename>
-- so the (storage.foldername(name))[1] check above scopes every file to its owner.
