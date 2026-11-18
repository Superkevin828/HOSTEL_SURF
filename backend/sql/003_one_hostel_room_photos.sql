-- BUhostels - update 3: one hostel per owner, 3 photos per room. Additive and safe to re-run.

create table if not exists public.room_images (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  path       text not null,
  url        text not null,
  position   smallint not null default 0 check (position between 0 and 2),
  created_at timestamptz not null default now()
);
create index if not exists room_images_room_idx on public.room_images (room_id);
alter table public.room_images enable row level security;

-- Give every owner who signed up but has no hostel yet one hostel built from their profile.
insert into public.hostels (owner_id, name, area, address, campus, phone, whatsapp, status)
select p.id,
       p.business_name,
       coalesce(nullif(p.location, ''), 'Not set'),
       p.address,
       p.campus,
       coalesce(nullif(p.phone, ''), ''),
       nullif(p.phone, ''),
       'published'
from public.profiles p
where p.role = 'owner'
  and nullif(p.business_name, '') is not null
  and not exists (select 1 from public.hostels h where h.owner_id = p.id);

-- One hostel per owner. Only enforced when no owner currently has two or more hostels.
do $$
begin
  if exists (select 1 from public.hostels group by owner_id having count(*) > 1) then
    raise notice 'Some owners have more than one hostel. Nothing was deleted. Merge them by hand, then run this file again to add the unique index.';
  else
    create unique index if not exists hostels_one_per_owner on public.hostels (owner_id);
  end if;
end $$;

-- Owners with duplicates (run this to check):
-- select owner_id, count(*) from public.hostels group by owner_id having count(*) > 1;
