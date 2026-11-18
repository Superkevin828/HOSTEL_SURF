-- BUhostels - update 4: owner hostel limits. Additive and safe to re-run.

alter table public.profiles
  add column if not exists max_hostels smallint not null default 1 check (max_hostels between 1 and 50),
  add column if not exists more_hostels_requested_at timestamptz;

-- Every owner keeps the hostel(s) they already have, so their limit starts at the current count.
update public.profiles p
set max_hostels = greatest(
  1,
  least(50, (select count(*) from public.hostels h where h.owner_id = p.id))
)::smallint
where p.role = 'owner'
  and p.max_hostels < (select count(*) from public.hostels h where h.owner_id = p.id);

-- One hostel per owner is no longer a hard rule; the backend checks each owner's limit.
drop index if exists public.hostels_one_per_owner;
