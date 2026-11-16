-- =============================================================================
-- Halaq — قاعدة البيانات الأساسية (Supabase / PostgreSQL)
-- شغّل الملف ده مرة واحدة من Supabase Dashboard > SQL Editor
-- =============================================================================

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.booking_status as enum ('pending','confirmed','completed','cancelled','no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_role as enum ('owner','manager','barber');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Profiles (one row per auth user)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          coalesce(new.raw_user_meta_data->>'phone', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Shops (tenants)
-- -----------------------------------------------------------------------------
create table if not exists public.shops (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  name             text not null check (char_length(name) between 2 and 80),
  area             text,
  address          text,
  phone            text,
  whatsapp         text,
  specialty        text,
  description      text,
  cover_url        text,
  map_url          text,
  timezone         text not null default 'Africa/Cairo',
  slot_step_min    int  not null default 15 check (slot_step_min in (5,10,15,20,30,60)),
  min_notice_min   int  not null default 30 check (min_notice_min between 0 and 1440),
  max_days_ahead   int  not null default 21 check (max_days_ahead between 1 and 90),
  cancel_cutoff_min int not null default 60 check (cancel_cutoff_min between 0 and 1440),
  auto_confirm     boolean not null default true,
  is_active        boolean not null default true,
  plan             text not null default 'trial' check (plan in ('trial','starter','pro')),
  trial_ends_at    timestamptz not null default (now() + interval '30 days'),
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

create table if not exists public.shop_members (
  shop_id    uuid not null references public.shops(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.member_role not null default 'barber',
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index if not exists shop_members_user_idx on public.shop_members(user_id);

-- Permission helpers (security definer so they can be used inside RLS without recursion)
create or replace function public.is_shop_staff(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_members m where m.shop_id = p_shop and m.user_id = auth.uid());
$$;

create or replace function public.is_shop_admin(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_members m
                 where m.shop_id = p_shop and m.user_id = auth.uid() and m.role in ('owner','manager'));
$$;

-- -----------------------------------------------------------------------------
-- Barbers, services, working hours, time off
-- -----------------------------------------------------------------------------
create table if not exists public.barbers (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  title       text,
  photo_url   text,
  user_id     uuid references auth.users(id) on delete set null,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists barbers_shop_idx on public.barbers(shop_id);

create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  description  text,
  duration_min int not null check (duration_min between 5 and 480),
  price        numeric(10,2) not null check (price >= 0),
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists services_shop_idx on public.services(shop_id);

-- weekday: 0 = Sunday ... 6 = Saturday. No row = closed that day.
-- closes <= opens means the shop closes after midnight (e.g. 14:00 → 02:00).
create table if not exists public.working_hours (
  shop_id  uuid not null references public.shops(id) on delete cascade,
  weekday  smallint not null check (weekday between 0 and 6),
  opens    time not null,
  closes   time not null,
  primary key (shop_id, weekday)
);

create table if not exists public.time_off (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  barber_id  uuid references public.barbers(id) on delete cascade,  -- null = whole shop closed
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists time_off_shop_idx on public.time_off(shop_id, starts_at);

-- -----------------------------------------------------------------------------
-- Bookings
-- -----------------------------------------------------------------------------
create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  barber_id       uuid not null references public.barbers(id) on delete restrict,
  customer_id     uuid references auth.users(id) on delete set null,
  customer_name   text not null check (char_length(customer_name) between 2 and 80),
  customer_phone  text not null check (char_length(customer_phone) between 7 and 20),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  total_duration  int not null,
  total_price     numeric(10,2) not null default 0,
  status          public.booking_status not null default 'pending',
  source          text not null default 'online' check (source in ('online','walk_in','phone')),
  payment_method  text not null default 'at_shop' check (payment_method in ('at_shop','instapay','wallet')),
  notes           text check (char_length(notes) <= 300),
  manage_token    uuid not null unique default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at),
  -- The heart of the system: the same barber can never have two overlapping active bookings.
  constraint bookings_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending','confirmed','completed'))
);
create index if not exists bookings_shop_time_idx on public.bookings(shop_id, starts_at);
create index if not exists bookings_customer_idx on public.bookings(customer_id);
create index if not exists bookings_phone_idx on public.bookings(shop_id, customer_phone);

create table if not exists public.booking_items (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  service_id   uuid references public.services(id) on delete set null,
  service_name text not null,
  price        numeric(10,2) not null,
  duration_min int not null
);
create index if not exists booking_items_booking_idx on public.booking_items(booking_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- Staff may change status / notes / payment only — not time, barber or price after the fact
-- (time changes go through cancel + rebook so the overlap rules always apply).
create or replace function public.guard_booking_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') then
    if new.shop_id <> old.shop_id or new.manage_token <> old.manage_token
       or new.code <> old.code or new.customer_id is distinct from old.customer_id then
      raise exception 'FORBIDDEN_FIELD';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists bookings_guard on public.bookings;
create trigger bookings_guard before update on public.bookings
  for each row execute function public.guard_booking_update();

-- -----------------------------------------------------------------------------
-- Reviews
-- -----------------------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references public.bookings(id) on delete cascade,
  shop_id     uuid not null references public.shops(id) on delete cascade,
  barber_id   uuid references public.barbers(id) on delete set null,
  customer_name text,
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 500),
  created_at  timestamptz not null default now()
);
create index if not exists reviews_shop_idx on public.reviews(shop_id, created_at desc);

-- Public directory view (runs with the caller's permissions → RLS still applies)
create or replace view public.shops_directory
with (security_invoker = true) as
select s.id, s.slug, s.name, s.area, s.specialty, s.description, s.cover_url, s.timezone,
       coalesce(round(avg(r.rating)::numeric, 1), 0) as rating,
       count(r.id)::int as reviews_count,
       (select min(price) from public.services sv where sv.shop_id = s.id and sv.is_active) as min_price
from public.shops s
left join public.reviews r on r.shop_id = s.id
where s.is_active
group by s.id;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles      enable row level security;
alter table public.shops         enable row level security;
alter table public.shop_members  enable row level security;
alter table public.barbers       enable row level security;
alter table public.services      enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_off      enable row level security;
alter table public.bookings      enable row level security;
alter table public.booking_items enable row level security;
alter table public.reviews       enable row level security;

-- profiles
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select using (id = auth.uid());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- shops: everyone sees active shops, staff see their own even if inactive; only admins edit.
drop policy if exists shops_select on public.shops;
create policy shops_select on public.shops for select using (is_active or public.is_shop_staff(id));
drop policy if exists shops_update on public.shops;
create policy shops_update on public.shops for update using (public.is_shop_admin(id)) with check (public.is_shop_admin(id));
-- (insert happens through create_shop(); no direct delete)

-- shop_members
drop policy if exists members_select on public.shop_members;
create policy members_select on public.shop_members for select
  using (user_id = auth.uid() or public.is_shop_admin(shop_id));

-- barbers / services / working_hours: public read for active shops, admins manage
drop policy if exists barbers_select on public.barbers;
create policy barbers_select on public.barbers for select
  using (exists (select 1 from public.shops s where s.id = shop_id and s.is_active) or public.is_shop_staff(shop_id));
drop policy if exists barbers_write on public.barbers;
create policy barbers_write on public.barbers for all
  using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

drop policy if exists services_select on public.services;
create policy services_select on public.services for select
  using (exists (select 1 from public.shops s where s.id = shop_id and s.is_active) or public.is_shop_staff(shop_id));
drop policy if exists services_write on public.services;
create policy services_write on public.services for all
  using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

drop policy if exists hours_select on public.working_hours;
create policy hours_select on public.working_hours for select
  using (exists (select 1 from public.shops s where s.id = shop_id and s.is_active) or public.is_shop_staff(shop_id));
drop policy if exists hours_write on public.working_hours;
create policy hours_write on public.working_hours for all
  using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

-- time_off: staff only (customers see the effect through available slots)
drop policy if exists timeoff_select on public.time_off;
create policy timeoff_select on public.time_off for select using (public.is_shop_staff(shop_id));
drop policy if exists timeoff_write on public.time_off;
create policy timeoff_write on public.time_off for all
  using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

-- bookings: customers see their own, staff see their shop's. Inserts go through create_booking().
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings for select
  using ((customer_id is not null and customer_id = auth.uid()) or public.is_shop_staff(shop_id));
drop policy if exists bookings_staff_update on public.bookings;
create policy bookings_staff_update on public.bookings for update
  using (public.is_shop_staff(shop_id)) with check (public.is_shop_staff(shop_id));

drop policy if exists items_select on public.booking_items;
create policy items_select on public.booking_items for select
  using (exists (select 1 from public.bookings b where b.id = booking_id
                 and ((b.customer_id is not null and b.customer_id = auth.uid()) or public.is_shop_staff(b.shop_id))));

-- reviews: public read, written via submit_review()
drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews for select using (true);

-- Grants (Supabase usually has these by default; repeated here to be explicit)
grant usage on schema public to anon, authenticated;
grant select on public.shops, public.barbers, public.services, public.working_hours,
                public.reviews, public.shops_directory to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.shops to authenticated;
grant select on public.shop_members to authenticated;
grant select, insert, update, delete on public.barbers, public.services, public.working_hours, public.time_off to authenticated;
grant select, update on public.bookings to authenticated;
grant select on public.booking_items to authenticated;

-- =============================================================================
-- Functions (RPC) — the only way to create shops, bookings and reviews
-- =============================================================================

-- Create a new shop and make the caller its owner.
create or replace function public.create_shop(
  p_name text, p_slug text, p_area text default null, p_phone text default null
) returns public.shops
language plpgsql security definer set search_path = public as $$
declare
  v_shop public.shops;
  d int;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if (select count(*) from shop_members where user_id = auth.uid() and role = 'owner') >= 5 then
    raise exception 'SHOP_LIMIT';
  end if;
  if exists (select 1 from shops where slug = lower(p_slug)) then
    raise exception 'SLUG_TAKEN';
  end if;

  insert into shops (name, slug, area, phone, whatsapp, created_by)
  values (trim(p_name), lower(trim(p_slug)), p_area, p_phone, p_phone, auth.uid())
  returning * into v_shop;

  insert into shop_members (shop_id, user_id, role) values (v_shop.id, auth.uid(), 'owner');

  -- default hours: every day 12:00 → 23:00
  for d in 0..6 loop
    insert into working_hours (shop_id, weekday, opens, closes) values (v_shop.id, d, '12:00', '23:00');
  end loop;

  return v_shop;
end $$;

-- Free start times for a given day. p_barber null = any barber.
create or replace function public.get_available_slots(
  p_shop uuid, p_date date, p_duration int, p_barber uuid default null
) returns table (slot_start timestamptz, barber_ids uuid[])
language sql stable security definer set search_path = public as $$
  with s as (
    select * from shops where id = p_shop and is_active
  ),
  wh as (
    select w.* from working_hours w, s
    where w.shop_id = s.id and w.weekday = extract(dow from p_date)::int
  ),
  bounds as (
    select ((p_date + wh.opens) at time zone s.timezone) as open_at,
           (((case when wh.closes <= wh.opens then p_date + 1 else p_date end) + wh.closes) at time zone s.timezone) as close_at,
           s.slot_step_min, s.min_notice_min, s.max_days_ahead, s.timezone
    from s, wh
  ),
  slots as (
    select g as t, b.min_notice_min, b.max_days_ahead, b.timezone
    from bounds b,
         generate_series(b.open_at, b.close_at - make_interval(mins => p_duration),
                         make_interval(mins => b.slot_step_min)) g
  ),
  brb as (
    select id from barbers
    where shop_id = p_shop and is_active and (p_barber is null or id = p_barber)
  )
  select sl.t as slot_start, array_agg(brb.id order by brb.id) as barber_ids
  from slots sl cross join brb
  where p_duration between 5 and 480
    and sl.t >= now() + make_interval(mins => sl.min_notice_min)
    and p_date <= (now() at time zone sl.timezone)::date + sl.max_days_ahead
    and not exists (
      select 1 from bookings k
      where k.barber_id = brb.id
        and k.status in ('pending','confirmed','completed')
        and tstzrange(k.starts_at, k.ends_at, '[)') && tstzrange(sl.t, sl.t + make_interval(mins => p_duration), '[)')
    )
    and not exists (
      select 1 from time_off o
      where o.shop_id = p_shop and (o.barber_id is null or o.barber_id = brb.id)
        and tstzrange(o.starts_at, o.ends_at, '[)') && tstzrange(sl.t, sl.t + make_interval(mins => p_duration), '[)')
    )
  group by sl.t
  order by sl.t;
$$;

-- Create a booking (customers online, or staff for walk-ins / phone bookings).
create or replace function public.create_booking(
  p_shop uuid,
  p_service_ids uuid[],
  p_starts_at timestamptz,
  p_name text,
  p_phone text,
  p_barber uuid default null,
  p_notes text default null,
  p_payment text default 'at_shop',
  p_source text default 'online'
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_shop     shops;
  v_duration int;
  v_price    numeric(10,2);
  v_count    int;
  v_barber   uuid;
  v_ids      uuid[];
  v_status   booking_status;
  v_booking  bookings;
  v_phone    text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  v_is_staff boolean;
begin
  select * into v_shop from shops where id = p_shop;
  if v_shop.id is null then raise exception 'SHOP_NOT_FOUND'; end if;
  v_is_staff := public.is_shop_staff(p_shop);
  if not v_shop.is_active and not v_is_staff then raise exception 'SHOP_NOT_FOUND'; end if;

  if p_source not in ('online','walk_in','phone') then raise exception 'BAD_SOURCE'; end if;
  if p_source <> 'online' and not v_is_staff then raise exception 'FORBIDDEN'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  if char_length(v_phone) < 7 then raise exception 'PHONE_REQUIRED'; end if;
  if p_payment not in ('at_shop','instapay','wallet') then p_payment := 'at_shop'; end if;

  select count(*), coalesce(sum(duration_min), 0), coalesce(sum(price), 0)
    into v_count, v_duration, v_price
  from services
  where shop_id = p_shop and is_active and id = any(p_service_ids);

  if v_count = 0 or v_count <> (select count(distinct x) from unnest(p_service_ids) x) then
    raise exception 'INVALID_SERVICES';
  end if;

  if p_source = 'online' then
    -- simple anti-spam: max 3 upcoming active bookings per phone per shop
    if (select count(*) from bookings
        where shop_id = p_shop and customer_phone = v_phone
          and status in ('pending','confirmed') and starts_at > now()) >= 3 then
      raise exception 'TOO_MANY_BOOKINGS';
    end if;

    select a.barber_ids into v_ids
    from public.get_available_slots(
           p_shop, (p_starts_at at time zone v_shop.timezone)::date, v_duration, p_barber) a
    where a.slot_start = p_starts_at;

    if v_ids is null or cardinality(v_ids) = 0 then raise exception 'SLOT_TAKEN'; end if;

    if p_barber is not null then
      v_barber := p_barber;
    else
      -- "any barber": give it to the least busy barber that day
      select x into v_barber from unnest(v_ids) x
      order by (select count(*) from bookings k
                where k.barber_id = x and k.status in ('pending','confirmed')
                  and (k.starts_at at time zone v_shop.timezone)::date = (p_starts_at at time zone v_shop.timezone)::date),
               x
      limit 1;
    end if;
    v_status := case when v_shop.auto_confirm then 'confirmed' else 'pending' end;
  else
    if p_barber is null or not exists (select 1 from barbers where id = p_barber and shop_id = p_shop) then
      raise exception 'BARBER_REQUIRED';
    end if;
    v_barber := p_barber;
    v_status := 'confirmed';
  end if;

  begin
    insert into bookings (shop_id, barber_id, customer_id, customer_name, customer_phone,
                          starts_at, ends_at, total_duration, total_price, status,
                          source, payment_method, notes)
    values (p_shop, v_barber,
            case when p_source = 'online' then auth.uid() else null end,
            trim(p_name), v_phone,
            p_starts_at, p_starts_at + make_interval(mins => v_duration), v_duration, v_price, v_status,
            p_source, p_payment, nullif(trim(coalesce(p_notes, '')), ''))
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;

  insert into booking_items (booking_id, service_id, service_name, price, duration_min)
  select v_booking.id, s.id, s.name, s.price, s.duration_min
  from services s where s.shop_id = p_shop and s.id = any(p_service_ids)
  order by s.sort_order, s.name;

  return json_build_object(
    'id', v_booking.id,
    'code', v_booking.code,
    'manage_token', v_booking.manage_token,
    'status', v_booking.status,
    'starts_at', v_booking.starts_at,
    'ends_at', v_booking.ends_at,
    'total_price', v_booking.total_price,
    'barber_id', v_booking.barber_id
  );
end $$;

-- Read one booking using its private link (works for guests without an account).
create or replace function public.get_booking_by_token(p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', b.id, 'code', b.code, 'status', b.status,
    'starts_at', b.starts_at, 'ends_at', b.ends_at,
    'total_price', b.total_price, 'total_duration', b.total_duration,
    'customer_name', b.customer_name, 'customer_phone', b.customer_phone,
    'payment_method', b.payment_method, 'notes', b.notes,
    'manage_token', b.manage_token,
    'can_cancel', (b.status in ('pending','confirmed')
                   and b.starts_at - make_interval(mins => s.cancel_cutoff_min) > now()),
    'can_review', (b.status = 'completed' and not exists (select 1 from reviews r where r.booking_id = b.id)),
    'shop', json_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'area', s.area,
                              'address', s.address, 'phone', s.phone, 'whatsapp', s.whatsapp,
                              'timezone', s.timezone, 'map_url', s.map_url,
                              'cancel_cutoff_min', s.cancel_cutoff_min),
    'barber', json_build_object('id', br.id, 'name', br.name),
    'items', coalesce((select json_agg(json_build_object('name', i.service_name, 'price', i.price,
                                                         'duration_min', i.duration_min))
                       from booking_items i where i.booking_id = b.id), '[]'::json)
  )
  from bookings b
  join shops s on s.id = b.shop_id
  join barbers br on br.id = b.barber_id
  where b.manage_token = p_token;
$$;

create or replace function public.cancel_booking_by_token(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_b bookings; v_cut int;
begin
  select * into v_b from bookings where manage_token = p_token for update;
  if v_b.id is null then raise exception 'NOT_FOUND'; end if;
  select cancel_cutoff_min into v_cut from shops where id = v_b.shop_id;
  if v_b.status not in ('pending','confirmed') then raise exception 'NOT_CANCELLABLE'; end if;
  if v_b.starts_at - make_interval(mins => v_cut) <= now() then raise exception 'TOO_LATE'; end if;
  update bookings set status = 'cancelled' where id = v_b.id;
  return public.get_booking_by_token(p_token);
end $$;

create or replace function public.submit_review(p_token uuid, p_rating int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_b bookings;
begin
  select * into v_b from bookings where manage_token = p_token;
  if v_b.id is null then raise exception 'NOT_FOUND'; end if;
  if v_b.status <> 'completed' then raise exception 'NOT_COMPLETED'; end if;
  if p_rating not between 1 and 5 then raise exception 'BAD_RATING'; end if;
  insert into reviews (booking_id, shop_id, barber_id, customer_name, rating, comment)
  values (v_b.id, v_b.shop_id, v_b.barber_id, split_part(v_b.customer_name, ' ', 1), p_rating,
          nullif(trim(coalesce(p_comment, '')), ''))
  on conflict (booking_id) do nothing;
end $$;

-- Is a slug free? (used live while the owner types the shop link)
create or replace function public.is_slug_available(p_slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select lower(p_slug) ~ '^[a-z0-9][a-z0-9-]{2,39}$'
     and not exists (select 1 from shops where slug = lower(p_slug));
$$;

revoke all on function public.create_shop(text,text,text,text) from public;
grant execute on function public.create_shop(text,text,text,text) to authenticated;
grant execute on function public.get_available_slots(uuid,date,int,uuid) to anon, authenticated;
grant execute on function public.create_booking(uuid,uuid[],timestamptz,text,text,uuid,text,text,text) to anon, authenticated;
grant execute on function public.get_booking_by_token(uuid) to anon, authenticated;
grant execute on function public.cancel_booking_by_token(uuid) to anon, authenticated;
grant execute on function public.submit_review(uuid,int,text) to anon, authenticated;
grant execute on function public.is_slug_available(text) to anon, authenticated;
grant execute on function public.is_shop_staff(uuid) to anon, authenticated;
grant execute on function public.is_shop_admin(uuid) to anon, authenticated;

-- Live updates for the shop dashboard (Supabase Realtime respects RLS)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.bookings;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
