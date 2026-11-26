-- Blocking a member also blocks the same person from coming back under another account:
--   device  : the app's per-device id (from visits)            – permanent, applies to everyone but admins
--   ip      : IPs the member used in the last 30 days            – 30 days, only stops NEW sign-ups / guests
--   phone   : the member's phone                                 – permanent
--   email   : the member's sign-in e-mail                        – permanent
alter table public.visits add column if not exists ip text;

create table if not exists public.blocked_identities (
  kind text not null check (kind in ('device', 'ip', 'phone', 'email')),
  value text not null,
  user_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (kind, value)
);
create index if not exists blocked_identities_user_idx on public.blocked_identities(user_id);
alter table public.blocked_identities enable row level security;
create policy "blocked: admin read" on public.blocked_identities for select to authenticated using (public.is_admin());
grant select on public.blocked_identities to authenticated;
grant all on public.blocked_identities to service_role;

create or replace function public.request_ip() returns text language sql stable as $$
  select nullif(trim(coalesce(
    nullif(current_setting('request.headers', true), '')::json->>'cf-connecting-ip',
    split_part(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ',', 1))), '')
$$;

create or replace function public.identity_blocked(p_kind text, p_value text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_value is not null and p_value <> '' and exists (
    select 1 from public.blocked_identities
    where kind = p_kind and value = lower(trim(p_value)) and (expires_at is null or expires_at > now()))
$$;
revoke all on function public.identity_blocked(text, text) from public, anon, authenticated;

-- Called by the app on start: true = this person is blocked.
create or replace function public.access_check(p_device text default null) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_admin() then return false; end if;
  if auth.uid() is not null and exists (select 1 from public.profiles where id = auth.uid() and blocked_at is not null) then return true; end if;
  if public.identity_blocked('device', p_device) then return true; end if;
  -- shared mobile IPs are common: an IP only stops people who are not signed in (new accounts)
  if auth.uid() is null and public.identity_blocked('ip', public.request_ip()) then return true; end if;
  return false;
end $$;
revoke all on function public.access_check(text) from public;
grant execute on function public.access_check(text) to anon, authenticated;

-- Service role only (the `account` function): record / clear a member's identities.
create or replace function public.set_member_block(p_user uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from public.blocked_identities where user_id = p_user;
  if not p_blocked then return; end if;
  insert into public.blocked_identities (kind, value, user_id, expires_at)
    select 'device', lower(device_id), p_user, null from public.visits where user_id = p_user and device_id not like 'nostorage%'
    union select 'ip', lower(ip), p_user, now() + interval '30 days' from public.visits where user_id = p_user and ip is not null and day > current_date - 30
    union select 'phone', phone, p_user, null from public.profiles where id = p_user and phone is not null
    union select 'email', lower(email), p_user, null from auth.users where id = p_user and email is not null and email not like '%@phone.sanadorder.app'
  on conflict (kind, value) do update set user_id = excluded.user_id, expires_at = excluded.expires_at, created_at = now();
end $$;
revoke all on function public.set_member_block(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_member_block(uuid, boolean) to service_role;

-- visits remember the IP (needed for the 30-day IP block)
create or replace function public.track_visit(p_device text, p_platform text default null, p_country text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  h json := nullif(current_setting('request.headers', true), '')::json;
  c text := upper(coalesce(h->>'cf-ipcountry', h->>'x-country-code', p_country));
begin
  if c !~ '^[A-Z]{2}$' or c in ('XX', 'T1') then c := null; end if;
  insert into public.visits (day, device_id, user_id, platform, country, ip)
  values ((now() at time zone 'Asia/Baghdad')::date, left(p_device, 64), auth.uid(), left(p_platform, 16), c, left(public.request_ip(), 64))
  on conflict (day, device_id) do update
    set hits = public.visits.hits + 1,
        last_seen = now(),
        user_id = coalesce(excluded.user_id, public.visits.user_id),
        platform = coalesce(excluded.platform, public.visits.platform),
        country = coalesce(excluded.country, public.visits.country),
        ip = coalesce(excluded.ip, public.visits.ip);
end $$;

-- new accounts with a blocked phone / e-mail are refused (sign-up and Google)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.identity_blocked('email', new.email)
     or public.identity_blocked('phone', public.normalize_phone(new.raw_user_meta_data->>'phone')) then
    raise exception 'account_blocked';
  end if;
  insert into public.profiles (id, full_name, phone, shop_name, city, address, username, role)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    public.normalize_phone(new.raw_user_meta_data->>'phone'),
    nullif(trim(new.raw_user_meta_data->>'shop_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'city'), ''),
    nullif(trim(new.raw_user_meta_data->>'address'), ''),
    nullif(lower(trim(new.raw_user_meta_data->>'username')), ''),
    case when exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email))
         then 'admin'::public.user_role else 'customer'::public.user_role end
  );
  return new;
end $$;

-- a member may not switch to a blocked phone (e.g. Google account completing its profile)
create or replace function public.protect_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare privileged boolean := public.is_admin() or coalesce(auth.role(), '') = 'service_role';
begin
  if not privileged then
    new.role := old.role;
    new.blocked_at := old.blocked_at;
    if new.phone is distinct from old.phone and public.identity_blocked('phone', new.phone) then
      raise exception 'account_blocked';
    end if;
  end if;
  return new;
end $$;
