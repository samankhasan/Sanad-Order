-- Payment methods for orders. Cash (on delivery) is live; FIB, Super Qi and FastPay are listed with
-- their logos but stay "coming soon" until an admin enables them (after the merchant agreements).
create table if not exists public.payment_methods (
  code text primary key check (code ~ '^[a-z0-9_]{2,20}$'),
  name_ku text not null,
  name_ar text not null,
  name_en text not null,
  logo_url text,
  is_enabled boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.payment_methods (code, name_ku, name_ar, name_en, is_enabled, sort_order) values
  ('cash',    'پارەی کاش لە کاتی وەرگرتن', 'الدفع نقداً عند الاستلام', 'Cash on delivery', true, 0),
  ('fib',     'FIB · بانکی یەکەمی عێراق',   'FIB · المصرف العراقي الأول', 'FIB · First Iraqi Bank', false, 1),
  ('qi',      'سوپەر کی (Super Qi)',        'سوبر كي (Super Qi)', 'Super Qi', false, 2),
  ('fastpay', 'فاست پەی (FastPay)',          'فاست باي (FastPay)', 'FastPay', false, 3)
on conflict (code) do nothing;
alter table public.payment_methods enable row level security;
create policy "payment methods: everyone reads" on public.payment_methods for select to anon, authenticated using (true);
create policy "payment methods: admin updates" on public.payment_methods for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.payment_methods to anon, authenticated;
grant update (logo_url, is_enabled, sort_order, name_ku, name_ar, name_en, updated_at) on public.payment_methods to authenticated;
grant all on public.payment_methods to service_role;

-- every order remembers how it is paid, and whether the money was received
alter table public.orders add column if not exists payment_method text not null default 'cash' references public.payment_methods(code);
alter table public.orders add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid'));
alter table public.orders add column if not exists paid_at timestamptz;

-- place_order gains the payment method (older apps that don't send it get cash)
drop function if exists public.place_order(jsonb, text);
create or replace function public.place_order(p_items jsonb, p_note text default null, p_payment text default 'cash')
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_prod public.products;
  v_qty int;
  v_total numeric(14,2) := 0;
  v_count int := 0;
  v_pay text := coalesce(nullif(trim(p_payment), ''), 'cash');
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and blocked_at is not null) then raise exception 'account_blocked'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'empty_cart'; end if;
  if not exists (select 1 from public.payment_methods where code = v_pay and is_enabled) then raise exception 'payment_unavailable'; end if;

  insert into public.orders (user_id, note, payment_method) values (auth.uid(), nullif(trim(p_note), ''), v_pay) returning * into v_order;

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
revoke all on function public.place_order(jsonb, text, text) from public, anon;
grant execute on function public.place_order(jsonb, text, text) to authenticated;
