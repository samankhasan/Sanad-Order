-- 1) Operators handle orders and support messages (never delete anything).
drop policy if exists "orders: read own or admin" on public.orders;
create policy "orders: read own or staff" on public.orders for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists "orders: admin update" on public.orders;
create policy "orders: staff update" on public.orders for update to authenticated using (public.is_staff()) with check (public.is_staff());
-- staff may change only the workflow fields of an order (never totals, items or owner)
revoke update on public.orders from authenticated;
grant update (status, payment_status, paid_at) on public.orders to authenticated;

drop policy if exists "order_items: read via order" on public.order_items;
create policy "order_items: read via order" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id and (o.user_id = auth.uid() or public.is_staff())));

drop policy if exists "support: read own or admin" on public.support_messages;
create policy "support: read own or staff" on public.support_messages for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists "support: admin answers" on public.support_messages;
create policy "support: staff answers" on public.support_messages for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- 2) Saved delivery locations ("Home", "Shop – Ankawa" …): name, phone, city, nearest landmark, GPS point
create table if not exists public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 60),
  contact_name text not null check (length(trim(contact_name)) between 1 and 80),
  phone text not null check (length(phone) between 6 and 20),
  city text,
  details text check (details is null or length(details) <= 300),
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);
create index if not exists user_addresses_user_idx on public.user_addresses(user_id, created_at desc);
create unique index if not exists user_addresses_one_default on public.user_addresses(user_id) where is_default;
alter table public.user_addresses enable row level security;
create policy "addresses: own" on public.user_addresses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.user_addresses to authenticated;
grant all on public.user_addresses to service_role;

-- every order keeps a copy of where it goes (the saved address may change later)
alter table public.orders add column if not exists delivery jsonb;

drop function if exists public.place_order(jsonb, text, text);
create or replace function public.place_order(p_items jsonb, p_note text default null, p_payment text default 'cash', p_address uuid default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_prod public.products;
  v_qty int;
  v_total numeric(14,2) := 0;
  v_count int := 0;
  v_pay text := coalesce(nullif(trim(p_payment), ''), 'cash');
  v_addr public.user_addresses;
  v_delivery jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and blocked_at is not null) then raise exception 'account_blocked'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'empty_cart'; end if;
  if not exists (select 1 from public.payment_methods where code = v_pay and is_enabled) then raise exception 'payment_unavailable'; end if;
  if p_address is not null then
    select * into v_addr from public.user_addresses where id = p_address and user_id = auth.uid();
    if not found then raise exception 'address_not_found'; end if;
    v_delivery := jsonb_build_object('label', v_addr.label, 'name', v_addr.contact_name, 'phone', v_addr.phone, 'city', v_addr.city,
                                     'details', v_addr.details, 'lat', v_addr.lat, 'lng', v_addr.lng);
  end if;

  insert into public.orders (user_id, note, payment_method, delivery) values (auth.uid(), nullif(trim(p_note), ''), v_pay, v_delivery) returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest(1, least(100000, (v_item->>'quantity')::int));
    select * into v_prod from public.products where id = (v_item->>'product_id')::uuid and is_active;
    if not found then raise exception 'product_unavailable'; end if;
    insert into public.order_items (order_id, product_id, category_id, product_name, size, unit, unit_price, quantity, line_total)
    values (v_order.id, v_prod.id, v_prod.category_id, v_prod.name, v_prod.size, v_prod.unit, v_prod.price, v_qty, v_prod.price * v_qty);
    v_total := v_total + v_prod.price * v_qty;
    v_count := v_count + v_qty;
  end loop;

  update public.orders set total = v_total, items_count = v_count where id = v_order.id returning * into v_order;
  return v_order;
end $$;
revoke all on function public.place_order(jsonb, text, text, uuid) from public, anon;
grant execute on function public.place_order(jsonb, text, text, uuid) to authenticated;
