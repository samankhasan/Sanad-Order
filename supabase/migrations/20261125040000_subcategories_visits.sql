-- Rename brand
update public.categories set name_ku = 'بۆیەی عەدەن' where slug = 'adan';

-- Sub-categories inside each brand
create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name_ku text not null,
  name_ar text,
  name_en text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index subcategories_category_idx on public.subcategories(category_id);
alter table public.subcategories enable row level security;
create policy "subcategories: public read" on public.subcategories for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "subcategories: admin write" on public.subcategories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.subcategories to anon, authenticated;
grant insert, update, delete on public.subcategories to authenticated;
grant select, insert, update, delete on public.subcategories to service_role;

alter table public.products add column subcategory_id uuid references public.subcategories(id) on delete set null;
create index products_subcategory_idx on public.products(subcategory_id);

-- Visitor analytics (one row per device per day, Baghdad time)
create table public.visits (
  day date not null,
  device_id text not null check (length(device_id) between 8 and 64),
  user_id uuid references public.profiles(id) on delete set null,
  platform text,
  hits int not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (day, device_id)
);
create index visits_user_idx on public.visits(user_id);
alter table public.visits enable row level security;
grant select, insert, update, delete on public.visits to service_role;

create or replace function public.track_visit(p_device text, p_platform text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.visits (day, device_id, user_id, platform)
  values ((now() at time zone 'Asia/Baghdad')::date, left(p_device, 64), auth.uid(), left(p_platform, 16))
  on conflict (day, device_id) do update
    set hits = public.visits.hits + 1,
        last_seen = now(),
        user_id = coalesce(excluded.user_id, public.visits.user_id),
        platform = coalesce(excluded.platform, public.visits.platform);
end $$;
revoke all on function public.track_visit(text, text) from public;
grant execute on function public.track_visit(text, text) to anon, authenticated;

create or replace function public.visit_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Baghdad')::date;
  res jsonb := '{}'::jsonb;
  p record;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  for p in select * from (values ('day', 0), ('week', 6), ('month', 29), ('year', 364)) as t(k, d) loop
    res := res || jsonb_build_object(p.k, (
      with v as (select * from public.visits where day between today - p.d and today),
           logged as (select distinct device_id from v where user_id is not null)
      select jsonb_build_object(
        'users',  (select count(distinct user_id) from v where user_id is not null),
        'guests', (select count(distinct device_id) from v where device_id not in (select device_id from logged)),
        'visits', coalesce((select sum(hits) from v), 0)
      )));
  end loop;
  res := res || jsonb_build_object('series', (
    select coalesce(jsonb_agg(jsonb_build_object('day', d, 'users', u, 'guests', g) order by d), '[]'::jsonb) from (
      select s.d::date d,
        (select count(distinct user_id) from public.visits where day = s.d and user_id is not null) u,
        (select count(distinct device_id) from public.visits v1 where day = s.d and not exists (
           select 1 from public.visits v2 where v2.day = s.d and v2.device_id = v1.device_id and v2.user_id is not null)) g
      from generate_series(today - 29, today, interval '1 day') s(d)
    ) x));
  return res;
end $$;
revoke all on function public.visit_stats() from public, anon;
grant execute on function public.visit_stats() to authenticated;
