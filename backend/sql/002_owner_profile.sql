-- BUhostels — update 1: business profile, campus and map location.
-- Run this once in Supabase → SQL Editor → New query → paste → Run.
-- Safe to run more than once.

alter table public.profiles
  add column if not exists business_name text,
  add column if not exists campus        text,
  add column if not exists location      text,
  add column if not exists address       text,
  add column if not exists avatar_url    text,
  add column if not exists avatar_path   text;

alter table public.hostels
  add column if not exists campus    text,
  add column if not exists latitude  numeric(9,6),
  add column if not exists longitude numeric(9,6);

create index if not exists hostels_campus_idx on public.hostels (campus);
