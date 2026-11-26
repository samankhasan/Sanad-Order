-- Visitor country (ISO 3166-1 alpha-2). Prefer the edge's country header, else what the app sends.
alter table public.visits add column if not exists country text check (country ~ '^[A-Z]{2}$');

drop function if exists public.track_visit(text, text);
create or replace function public.track_visit(p_device text, p_platform text default null, p_country text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  h json := nullif(current_setting('request.headers', true), '')::json;
  c text := upper(coalesce(h->>'cf-ipcountry', h->>'x-country-code', p_country));
begin
  if c !~ '^[A-Z]{2}$' or c in ('XX', 'T1') then c := null; end if;
  insert into public.visits (day, device_id, user_id, platform, country)
  values ((now() at time zone 'Asia/Baghdad')::date, left(p_device, 64), auth.uid(), left(p_platform, 16), c)
  on conflict (day, device_id) do update
    set hits = public.visits.hits + 1,
        last_seen = now(),
        user_id = coalesce(excluded.user_id, public.visits.user_id),
        platform = coalesce(excluded.platform, public.visits.platform),
        country = coalesce(excluded.country, public.visits.country);
end $$;
revoke all on function public.track_visit(text, text, text) from public;
grant execute on function public.track_visit(text, text, text) to anon, authenticated;

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
        'visits', coalesce((select sum(hits) from v), 0),
        'countries', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'devices', n, 'visits', h) order by n desc, h desc), '[]'::jsonb)
                      from (select coalesce(country, '??') code, count(distinct device_id) n, sum(hits) h
                            from v group by 1 order by 2 desc, 3 desc limit 30) cc)
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
