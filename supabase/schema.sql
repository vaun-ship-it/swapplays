-- Swap Plays Supabase starter schema.
-- Run this in Supabase SQL Editor after reviewing the policies for your launch rules.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null default 'Swap Plays User',
  points integer not null default 0,
  overall_points integer not null default 0,
  profile_photo_url text,
  profile_link text,
  autoplay_active boolean not null default false,
  autoplay_plan text,
  autoplay_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_email text,
  title text not null,
  category text not null check (category in ('Music', 'Podcast', 'Food', 'Sports', 'Gaming', 'Comedy', 'Other')),
  media_url text not null,
  media_kind text not null check (media_kind in ('audio', 'video')),
  thumbnail_url text,
  external_link text,
  plays_target integer not null check (plays_target > 0),
  seconds_target integer not null check (seconds_target > 0),
  points_cost integer not null check (points_cost >= 0),
  plays_done integer not null default 0 check (plays_done >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.pass_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  points integer not null check (points > 0),
  used boolean not null default false,
  used_by_user_id uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.play_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  points_earned integer not null check (points_earned >= 0),
  seconds_completed integer not null check (seconds_completed >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.pass_codes enable row level security;
alter table public.play_history enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "campaigns_select_all" on public.campaigns
  for select using (true);

create policy "campaigns_insert_own" on public.campaigns
  for insert with check (auth.uid() = user_id);

create policy "campaigns_update_own" on public.campaigns
  for update using (auth.uid() = user_id);

create policy "campaigns_delete_own" on public.campaigns
  for delete using (auth.uid() = user_id);

create policy "play_history_select_own" on public.play_history
  for select using (auth.uid() = user_id);

create policy "play_history_insert_own" on public.play_history
  for insert with check (auth.uid() = user_id);

-- Pass code validation should be done through an Edge Function or RPC so users cannot mark codes used directly.

insert into storage.buckets (id, name, public)
values ('media-uploads', 'media-uploads', true)
on conflict (id) do nothing;

create policy "media_uploads_read_public" on storage.objects
  for select using (bucket_id = 'media-uploads');

create policy "media_uploads_insert_own_folder" on storage.objects
  for insert with check (
    bucket_id = 'media-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "media_uploads_update_own_folder" on storage.objects
  for update using (
    bucket_id = 'media-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "media_uploads_delete_own_folder" on storage.objects
  for delete using (
    bucket_id = 'media-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
