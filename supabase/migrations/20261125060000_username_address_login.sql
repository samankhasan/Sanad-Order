alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists address text;
create unique index if not exists profiles_username_key on public.profiles (lower(username));
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9._]{3,30}$');

-- same rules as the app: 0750… / +964750… / 00964… / 750… → 9647501234567
create or replace function public.normalize_phone(p text)
returns text language plpgsql immutable set search_path = public as $$
declare d text;
begin
  d := translate(coalesce(p, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  d := regexp_replace(d, '\D', '', 'g');
  if d like '00%' then d := substr(d, 3); end if;
  if d like '0%' then d := '964' || substr(d, 2);
  elsif length(d) = 10 and d like '7%' then d := '964' || d;
  end if;
  return nullif(d, '');
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
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

-- sign-in helper: username / phone / e-mail → the account's e-mail (null if none)
create or replace function public.login_email(p_identifier text)
returns text language plpgsql stable security definer set search_path = public, auth as $$
declare v text := trim(coalesce(p_identifier, '')); e text;
begin
  if v = '' then return null; end if;
  if position('@' in v) > 0 then return lower(v); end if;
  if v ~ '^[+\s0-9٠-٩۰-۹()-]+$' then
    select u.email into e from public.profiles p join auth.users u on u.id = p.id
      where p.phone = public.normalize_phone(v) order by p.created_at limit 1;
    if e is null then e := public.normalize_phone(v) || '@phone.sanadorder.app'; end if;
    return e;
  end if;
  select u.email into e from public.profiles p join auth.users u on u.id = p.id where lower(p.username) = lower(v);
  return e;
end $$;
revoke all on function public.login_email(text) from public;
grant execute on function public.login_email(text) to anon, authenticated;

create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select lower(trim(p_username)) ~ '^[a-z0-9._]{3,30}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(trim(p_username)));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

update public.profiles set phone = public.normalize_phone(phone) where phone is not null;
