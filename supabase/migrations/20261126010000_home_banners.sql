-- Riyadh brand: Kurdish label as the owner wants it
update public.categories set name_ku = 'دهانات الریاض' where slug = 'riyadh';

-- Two home-page ad banners (slot 1 and 2), editable by admins
create table if not exists public.home_banners (
  slot int primary key check (slot between 1 and 2),
  image_url text,
  link text check (link is null or length(link) <= 500),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.home_banners (slot) values (1), (2) on conflict do nothing;
alter table public.home_banners enable row level security;
create policy "banners: read active" on public.home_banners for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "banners: admin update" on public.home_banners for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.home_banners to anon, authenticated;
grant update on public.home_banners to authenticated;
grant all on public.home_banners to service_role;

-- Best sellers: ranked by quantity sold (cancelled excluded); products not sold yet follow, newest first
create or replace function public.popular_products(p_limit int default 10)
returns setof public.products language sql stable security definer set search_path = public as $$
  select p.*
  from public.products p
  left join (
    select oi.product_id, sum(oi.quantity) as qty
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.status <> 'cancelled' and oi.product_id is not null
    group by oi.product_id
  ) s on s.product_id = p.id
  where p.is_active
  order by coalesce(s.qty, 0) desc, p.created_at desc
  limit least(greatest(p_limit, 1), 30);
$$;
