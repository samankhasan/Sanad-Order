-- Admins can block members. Blocked members cannot sign in (auth ban, set by the `account` function)
-- and cannot place orders even with a still-valid token.
alter table public.profiles add column if not exists blocked_at timestamptz;

create or replace function public.protect_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare privileged boolean := public.is_admin() or coalesce(auth.role(), '') = 'service_role';
begin
  if not privileged then
    new.role := old.role;
    new.blocked_at := old.blocked_at;
  end if;
  return new;
end $$;

create or replace function public.place_order(p_items jsonb, p_note text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_prod public.products;
  v_qty int;
  v_total numeric(14,2) := 0;
  v_count int := 0;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and blocked_at is not null) then raise exception 'account_blocked'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'empty_cart'; end if;

  insert into public.orders (user_id, note) values (auth.uid(), nullif(trim(p_note), '')) returning * into v_order;

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
