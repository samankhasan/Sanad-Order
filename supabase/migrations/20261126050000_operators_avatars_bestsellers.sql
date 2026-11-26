-- Staff = admin or operator
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'operator') and blocked_at is null)
$$;
grant execute on function public.is_staff() to authenticated;

-- operators: see members, add products (+ their pictures); no update / delete anywhere
drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or staff" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "products: operator insert" on public.products for insert to authenticated with check (public.is_staff());
drop policy if exists "products: public read" on public.products;
create policy "products: public read" on public.products for select to anon, authenticated using (is_active or public.is_staff());
create policy "product-images: staff insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff());

-- profile pictures: public bucket, each member writes only inside their own folder
alter table public.profiles add column if not exists avatar_url text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "avatars: own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: own select" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Best sellers: only products that were actually sold, most quantity first
create or replace function public.popular_products(p_limit int default 10)
returns setof public.products language sql stable security definer set search_path = public as $$
  select p.*
  from public.products p
  join (
    select oi.product_id, sum(oi.quantity) as qty
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.status <> 'cancelled' and oi.product_id is not null
    group by oi.product_id
  ) s on s.product_id = p.id
  where p.is_active
  order by s.qty desc, p.created_at desc
  limit least(greatest(p_limit, 1), 30);
$$;
