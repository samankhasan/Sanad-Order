-- 1) Error monitoring: the app reports crashes / unhandled errors here; admins see them grouped.
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  fingerprint text not null,
  message text not null,
  stack text,
  url text,
  app_version text not null default '',
  platform text,
  user_agent text,
  user_id uuid references public.profiles(id) on delete set null,
  device text,
  count int not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  resolved_at timestamptz,
  unique (fingerprint, app_version)
);
create index if not exists app_errors_last_seen_idx on public.app_errors(last_seen desc);
create index if not exists app_errors_user_idx on public.app_errors(user_id);
alter table public.app_errors enable row level security;
create policy "errors: admin read" on public.app_errors for select to authenticated using (public.is_admin());
create policy "errors: admin resolve" on public.app_errors for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "errors: admin delete" on public.app_errors for delete to authenticated using (public.is_admin());
grant select, delete on public.app_errors to authenticated;
grant update (resolved_at) on public.app_errors to authenticated;
grant all on public.app_errors to service_role;

-- same error again → count + 1 (and reopen it if it had been marked fixed); at most 30 new kinds per device per hour
create or replace function public.log_client_error(p_message text, p_stack text, p_url text, p_version text, p_platform text, p_user_agent text, p_device text)
returns void language plpgsql security definer set search_path = public as $$
declare v_msg text := left(coalesce(nullif(trim(p_message), ''), 'Unknown error'), 500);
        v_stack text := left(p_stack, 4000);
        v_fp text;
begin
  v_fp := md5(v_msg || '|' || coalesce(split_part(coalesce(v_stack, ''), E'\n', 2), ''));
  if (select count(*) from public.app_errors where device = left(p_device, 64) and first_seen > now() - interval '1 hour') >= 30 then return; end if;
  insert into public.app_errors (fingerprint, message, stack, url, app_version, platform, user_agent, user_id, device)
  values (v_fp, v_msg, v_stack, left(p_url, 500), left(coalesce(p_version, ''), 20), left(p_platform, 20), left(p_user_agent, 300), auth.uid(), left(p_device, 64))
  on conflict (fingerprint, app_version) do update
    set count = public.app_errors.count + 1, last_seen = now(), resolved_at = null,
        url = excluded.url, user_id = coalesce(excluded.user_id, public.app_errors.user_id), platform = excluded.platform, user_agent = excluded.user_agent;
end $$;
revoke all on function public.log_client_error(text, text, text, text, text, text, text) from public;
grant execute on function public.log_client_error(text, text, text, text, text, text, text) to anon, authenticated;

-- 2) "Notify me when it's back in stock"
create table if not exists public.stock_alerts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  pushed_at timestamptz,
  primary key (user_id, product_id)
);
create index if not exists stock_alerts_product_idx on public.stock_alerts(product_id) where notified_at is null;
alter table public.stock_alerts enable row level security;
create policy "stock alerts: read own or staff" on public.stock_alerts for select to authenticated using (user_id = (select auth.uid()) or public.is_staff());
create policy "stock alerts: add own" on public.stock_alerts for insert to authenticated with check (user_id = (select auth.uid()));
create policy "stock alerts: remove own" on public.stock_alerts for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.stock_alerts to authenticated;
grant all on public.stock_alerts to service_role;

-- product goes from "out of stock" to "in stock" → an in-app notification (in the member's language) for everyone waiting
create or replace function public.notify_back_in_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_slug text;
begin
  if not (old.in_stock is false and new.in_stock is true and new.is_active) then return new; end if;
  select slug into v_slug from public.categories where id = new.category_id;
  insert into public.notifications (title, body, image_url, link, target_user)
  select case p.lang when 'ar' then '✅ عاد إلى المخزون: ' when 'en' then '✅ Back in stock: ' else '✅ هاتەوە: ' end || new.name,
         case p.lang when 'ar' then 'المنتج الذي كنت تنتظره متوفر الآن. اطلبه قبل نفاده!'
                     when 'en' then 'The product you were waiting for is available again. Order before it runs out!'
                     else 'ئەو بەرهەمەی چاوەڕێت دەکرد ئێستا بەردەستە. پێش تەواوبوون داوای بکە!' end,
         new.image_url, '/c/' || coalesce(v_slug, '') || '?p=' || new.id, a.user_id
  from public.stock_alerts a join public.profiles p on p.id = a.user_id
  where a.product_id = new.id and a.notified_at is null and p.blocked_at is null;
  update public.stock_alerts set notified_at = now() where product_id = new.id and notified_at is null;
  return new;
end $$;
drop trigger if exists products_back_in_stock on public.products;
create trigger products_back_in_stock after update of in_stock on public.products
  for each row execute function public.notify_back_in_stock();

-- 3) Sales report for admins: totals, comparison with the previous period of the same length, daily series and breakdowns
create or replace function public.sales_report(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_len interval := p_to - p_from;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  with o as (select * from public.orders where created_at >= p_from and created_at < p_to),
  ok as (select * from o where status <> 'cancelled'),
  prev as (select * from public.orders where created_at >= p_from - v_len and created_at < p_from and status <> 'cancelled'),
  items as (select i.* from public.order_items i join ok on ok.id = i.order_id)
  select jsonb_build_object(
    'kpi', jsonb_build_object(
      'orders', (select count(*) from ok),
      'revenue', (select coalesce(sum(total), 0) from ok),
      'delivered_revenue', (select coalesce(sum(total), 0) from ok where status = 'delivered'),
      'paid_revenue', (select coalesce(sum(total), 0) from ok where payment_status = 'paid'),
      'cancelled', (select count(*) from o where status = 'cancelled'),
      'customers', (select count(distinct user_id) from ok),
      'items', (select coalesce(sum(quantity), 0) from items),
      'new_members', (select count(*) from public.profiles where created_at >= p_from and created_at < p_to and role = 'customer'),
      'prev_orders', (select count(*) from prev),
      'prev_revenue', (select coalesce(sum(total), 0) from prev)),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'orders', n, 'revenue', rev) order by d), '[]'::jsonb)
              from (select (created_at at time zone 'Asia/Baghdad')::date d, count(*) n, sum(total) rev from ok group by 1) x),
    'products', (select coalesce(jsonb_agg(x order by x.revenue desc), '[]'::jsonb)
                 from (select product_name as name, max(size) as size, sum(quantity) as qty, sum(line_total) as revenue, count(distinct order_id) as orders
                       from items group by product_name order by sum(line_total) desc limit 500) x),
    'brands', (select coalesce(jsonb_agg(x order by x.revenue desc), '[]'::jsonb)
               from (select coalesce(c.name_ku, '—') as name_ku, coalesce(c.name_ar, '—') as name_ar, coalesce(c.name_en, '—') as name_en, c.accent,
                            sum(i.line_total) as revenue, sum(i.quantity) as qty
                     from items i left join public.categories c on c.id = i.category_id group by c.id, c.name_ku, c.name_ar, c.name_en, c.accent) x),
    'cities', (select coalesce(jsonb_agg(x order by x.revenue desc), '[]'::jsonb)
               from (select coalesce(nullif(ok.delivery->>'city', ''), nullif(p.city, ''), '') as city, count(*) as orders, sum(ok.total) as revenue
                     from ok left join public.profiles p on p.id = ok.user_id group by 1) x),
    'statuses', (select coalesce(jsonb_object_agg(s, n), '{}'::jsonb) from (select status::text s, count(*) n from o group by 1) x),
    'payments', (select coalesce(jsonb_agg(x order by x.revenue desc), '[]'::jsonb)
                 from (select coalesce(payment_method, 'cash') as code, count(*) as orders, sum(total) as revenue from ok group by 1) x)
  ) into r;
  return r;
end $$;
revoke all on function public.sales_report(timestamptz, timestamptz) from public;
grant execute on function public.sales_report(timestamptz, timestamptz) to authenticated;

-- 4) Activity log: every change made by staff (admins / operators) — who, what, when, old → new
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid references public.profiles(id) on delete set null,
  action text not null,           -- insert | update | delete | or a named action (block, unblock, delete_member, set_password, …)
  entity text not null,           -- table name or 'member', 'notification'
  entity_id text,
  label text,                     -- product name, order number, member name, …
  changes jsonb                   -- { column: [old, new] } for updates
);
create index if not exists audit_log_at_idx on public.audit_log(at desc);
create index if not exists audit_log_actor_idx on public.audit_log(actor, at desc);
alter table public.audit_log enable row level security;
create policy "audit: admin read" on public.audit_log for select to authenticated using (public.is_admin());
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); o jsonb; n jsonb; d jsonb := '{}'::jsonb; k text; r jsonb;
begin
  if v_actor is null or not public.is_staff() then return coalesce(new, old); end if;
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if k not in ('updated_at', 'rating_avg', 'rating_count', 'sort_order', 'notifications_seen_at', 'lang', 'push_sent', 'push_failed', 'seen_at', 'replied_at', 'replied_by', 'paid_at')
         and (o -> k) is distinct from (n -> k) then
        d := d || jsonb_build_object(k, jsonb_build_array(
          case when length((o -> k)::text) > 300 then to_jsonb(left(o ->> k, 280) || '…') else o -> k end,
          case when length((n -> k)::text) > 300 then to_jsonb(left(n ->> k, 280) || '…') else n -> k end));
      end if;
    end loop;
    if d = '{}'::jsonb then return new; end if;
  end if;
  r := coalesce(n, o);
  insert into public.audit_log (actor, action, entity, entity_id, label, changes)
  values (v_actor, lower(tg_op), tg_table_name, coalesce(r ->> 'id', r ->> 'code', r ->> 'slot'),
          left(coalesce(r ->> 'name', r ->> 'name_ku', r ->> 'title', r ->> 'full_name', '#' || (r ->> 'order_no'), r ->> 'comment', r ->> 'body'), 160),
          case when tg_op = 'UPDATE' then d end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['products', 'categories', 'subcategories', 'orders', 'profiles', 'rewards', 'challenges', 'payment_methods', 'home_banners', 'product_reviews', 'support_messages']
  loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
  end loop;
end $$;
