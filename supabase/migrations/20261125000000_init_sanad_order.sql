-- Sanad Order — initial schema (already applied to the Supabase project "sanad order").
-- Admin accounts: add an email to public.admin_emails (SQL editor only, never from the app);
-- anyone who signs up with that email becomes admin automatically.

-- ===== Enums =====
create type public.user_role as enum ('admin','customer');
create type public.order_status as enum ('pending','confirmed','preparing','on_the_way','delivered','cancelled');

-- ===== Private admin allow-list (no client access) =====
create table public.admin_emails (
  email text primary key
);
alter table public.admin_emails enable row level security;
revoke all on public.admin_emails from anon, authenticated;

-- ===== Profiles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  shop_name text,
  city text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, shop_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'shop_name',
    case when exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email))
         then 'admin'::public.user_role else 'customer'::public.user_role end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- prevent customers from promoting themselves
create or replace function public.protect_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end $$;
create trigger profiles_protect_role before update on public.profiles
for each row execute function public.protect_role();

create policy "profiles: read own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles: update own or admin" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- ===== Categories (brands) =====
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_en text not null,
  name_ku text not null,
  name_ar text not null,
  logo text,
  accent text not null default '#111827',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "categories: public read" on public.categories for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "categories: admin write" on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===== Products =====
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  description text,
  sku text,
  size text,
  unit text not null default 'piece',
  price numeric(14,2) not null default 0 check (price >= 0),
  image_url text,
  in_stock boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products(category_id);
alter table public.products enable row level security;
create policy "products: public read" on public.products for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "products: admin write" on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger products_touch before update on public.products
for each row execute function public.touch_updated_at();

-- ===== Orders =====
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity (start with 1001),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.order_status not null default 'pending',
  note text,
  total numeric(14,2) not null default 0,
  items_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders(user_id);
create index orders_created_idx on public.orders(created_at desc);
alter table public.orders enable row level security;
create policy "orders: read own or admin" on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "orders: admin update" on public.orders for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "orders: admin delete" on public.orders for delete to authenticated
  using (public.is_admin());
create trigger orders_touch before update on public.orders
for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  product_name text not null,
  size text,
  unit text,
  unit_price numeric(14,2) not null,
  quantity int not null check (quantity > 0),
  line_total numeric(14,2) not null
);
create index order_items_order_idx on public.order_items(order_id);
create index order_items_product_idx on public.order_items(product_id);
create index order_items_category_idx on public.order_items(category_id);
alter table public.order_items enable row level security;
create policy "order_items: read via order" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

-- ===== Place order RPC: prices are always taken from the DB =====
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
revoke all on function public.place_order(jsonb, text) from public, anon;
grant execute on function public.place_order(jsonb, text) to authenticated;

-- customers may cancel their own pending order
create or replace function public.cancel_my_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'cancelled'
  where id = p_order and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'cannot_cancel'; end if;
end $$;
revoke all on function public.cancel_my_order(uuid) from public, anon;
grant execute on function public.cancel_my_order(uuid) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_role() from public, anon, authenticated;

-- ===== Storage bucket for product images =====
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
on conflict (id) do nothing;
create policy "product-images: admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product-images: admin update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
create policy "product-images: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ===== Realtime for live order status =====
alter publication supabase_realtime add table public.orders;

-- ===== Seed brands =====
insert into public.categories (slug, name_en, name_ku, name_ar, logo, accent, sort_order) values
  ('adan',   'Adan Paints',   'دەهاناتی عەدەن',  'دهانات عدن',    'brands/adan.webp',   '#12A150', 1),
  ('fab',    'FAB Paints',    'بۆیەی فاب',       'دهانات فاب',    'brands/fab.webp',    '#E0262F', 2),
  ('riyadh', 'Riyadh Paints', 'دەهاناتی ڕیاز',   'دهانات الرياض', 'brands/riyadh.png',  '#D4610F', 3),
  ('tools',  'Tools',         'ئامرازەکان',      'العدد والأدوات', 'brands/tools.svg',   '#2563EB', 4);
