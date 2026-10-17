-- BUhostels — database schema
-- Run this whole file once in Supabase → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

-- ───────────────────────── tables ─────────────────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null,
  phone       text,
  role        text not null default 'owner'   check (role in ('admin', 'owner')),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  created_at  timestamptz not null default now()
);

create table if not exists public.hostels (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  description  text,
  area         text not null,
  address      text,
  distance_km  numeric(4,1),
  phone        text not null,
  whatsapp     text,
  gender       text not null default 'mixed' check (gender in ('mixed', 'male', 'female')),
  amenities    text[] not null default '{}',
  status       text not null default 'published' check (status in ('published', 'hidden')),
  featured     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  hostel_id    uuid not null references public.hostels(id) on delete cascade,
  name         text not null,
  type         text not null check (type in ('single', 'double', 'triple', 'self_contained', 'shared')),
  price        integer not null check (price >= 0),          -- UGX per semester
  available    integer not null default 0 check (available >= 0),
  description  text,
  created_at   timestamptz not null default now()
);

create table if not exists public.hostel_images (
  id          uuid primary key default gen_random_uuid(),
  hostel_id   uuid not null references public.hostels(id) on delete cascade,
  path        text not null,
  url         text not null,
  is_cover    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  type        text not null,
  hostel_id   uuid references public.hostels(id) on delete set null,
  actor_id    uuid,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists hostels_status_idx   on public.hostels (status);
create index if not exists hostels_owner_idx    on public.hostels (owner_id);
create index if not exists rooms_hostel_idx     on public.rooms (hostel_id);
create index if not exists images_hostel_idx    on public.hostel_images (hostel_id);
create index if not exists events_created_idx   on public.events (created_at desc);
create index if not exists events_type_idx      on public.events (type, created_at desc);
create index if not exists events_hostel_idx    on public.events (hostel_id);

-- keep hostels.updated_at fresh
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists hostels_touch on public.hostels;
create trigger hostels_touch before update on public.hostels
  for each row execute function public.touch_updated_at();

-- ───────────────────────── security ─────────────────────────
-- All access goes through the Express backend using the service-role key,
-- so the public (anon) key gets no direct table access at all.

alter table public.profiles       enable row level security;
alter table public.hostels        enable row level security;
alter table public.rooms          enable row level security;
alter table public.hostel_images  enable row level security;
alter table public.events         enable row level security;

-- ───────────────────────── reporting ─────────────────────────

create or replace view public.hostel_stats
with (security_invoker = true) as
select
  hostel_id,
  count(*) filter (where type = 'view')                 as views,
  count(*) filter (where type in ('whatsapp', 'call'))  as contacts
from public.events
where hostel_id is not null
group by hostel_id;

-- Per-hostel numbers for one owner's dashboard.
create or replace function public.owner_stats(p_owner uuid, p_days int default 30)
returns table (hostel_id uuid, name text, views bigint, whatsapp bigint, calls bigint)
language sql stable as $$
  select h.id,
         h.name,
         count(*) filter (where e.type = 'view'),
         count(*) filter (where e.type = 'whatsapp'),
         count(*) filter (where e.type = 'call')
  from public.hostels h
  left join public.events e
    on e.hostel_id = h.id
   and e.created_at > now() - make_interval(days => p_days)
  where h.owner_id = p_owner
  group by h.id, h.name, h.created_at
  order by h.created_at desc;
$$;

-- Everything the admin overview needs, in one call. Days are counted in Kampala time.
create or replace function public.site_stats(p_days int default 14)
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'hostels',         (select count(*) from public.hostels),
      'published',       (select count(*) from public.hostels where status = 'published'),
      'rooms',           (select count(*) from public.rooms),
      'photos',          (select count(*) from public.hostel_images),
      'owners',          (select count(*) from public.profiles where role = 'owner'),
      'owners_approved', (select count(*) from public.profiles where role = 'owner' and status = 'approved'),
      'owners_pending',  (select count(*) from public.profiles where role = 'owner' and status = 'pending')
    ),
    'period', (
      select jsonb_build_object(
        'visits',   count(*) filter (where type = 'visit'),
        'visitors', count(distinct meta->>'vid') filter (where type = 'visit'),
        'views',    count(*) filter (where type = 'view'),
        'whatsapp', count(*) filter (where type = 'whatsapp'),
        'calls',    count(*) filter (where type = 'call'),
        'searches', count(*) filter (where type = 'search')
      )
      from public.events
      where created_at > now() - make_interval(days => p_days)
    ),
    'series', coalesce((
      select jsonb_agg(
               jsonb_build_object('day', s.day, 'visits', s.visits, 'visitors', s.visitors, 'contacts', s.contacts)
               order by s.day)
      from (
        select d::date as day,
               count(e.id) filter (where e.type = 'visit')                as visits,
               count(distinct e.meta->>'vid') filter (where e.type = 'visit') as visitors,
               count(e.id) filter (where e.type in ('whatsapp', 'call'))  as contacts
        from generate_series(
               ((now() at time zone 'Africa/Kampala')::date - (p_days - 1))::timestamp,
               (now() at time zone 'Africa/Kampala')::date::timestamp,
               interval '1 day') d
        left join public.events e
          on e.created_at >= (d at time zone 'Africa/Kampala')
         and e.created_at <  ((d + interval '1 day') at time zone 'Africa/Kampala')
        group by d
      ) s
    ), '[]'::jsonb),
    'top_hostels', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'area', t.area, 'views', t.views, 'contacts', t.contacts)
                       order by t.views desc, t.contacts desc)
      from (
        select h.id, h.name, h.area,
               count(*) filter (where e.type = 'view')                    as views,
               count(*) filter (where e.type in ('whatsapp', 'call'))     as contacts
        from public.hostels h
        left join public.events e
          on e.hostel_id = h.id
         and e.created_at > now() - make_interval(days => p_days)
        group by h.id, h.name, h.area
        order by 4 desc, 5 desc
        limit 8
      ) t
    ), '[]'::jsonb),
    'top_searches', coalesce((
      select jsonb_agg(jsonb_build_object('term', q.term, 'n', q.n) order by q.n desc)
      from (
        select lower(meta->>'q') as term, count(*) as n
        from public.events
        where type = 'search'
          and coalesce(meta->>'q', '') <> ''
          and created_at > now() - make_interval(days => p_days)
        group by 1
        order by n desc
        limit 8
      ) q
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.owner_stats(uuid, int) from public, anon, authenticated;
revoke execute on function public.site_stats(int)        from public, anon, authenticated;

-- ───────────────────────── photo storage ─────────────────────────
-- Public bucket: anyone can view photos, only the backend can upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hostel-images', 'hostel-images', true, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
