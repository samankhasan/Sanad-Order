-- Best sellers for the home page: products ranked by quantity sold (cancelled orders excluded).
-- Security definer so customers see the ranking without reading other people's orders.
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
revoke all on function public.popular_products(int) from public;
grant execute on function public.popular_products(int) to anon, authenticated;
