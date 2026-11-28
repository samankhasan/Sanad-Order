-- Ratings move from the order page to each product page: any signed-in, non-blocked member can rate a
-- product (one rating per member per product; rating again updates it). Members who received the product
-- in a delivered order are shown as "verified purchase".
create or replace function public.can_review(p_product uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
  and exists (select 1 from public.products where id = p_product)
  and not exists (select 1 from public.profiles where id = auth.uid() and blocked_at is not null)
$$;

-- star breakdown for the product page (average, total, count per star)
create or replace function public.product_rating_summary(p_product uuid)
returns table (avg numeric, total int, s1 int, s2 int, s3 int, s4 int, s5 int)
language sql stable security definer set search_path = public as $$
  select coalesce(round(avg(rating)::numeric, 1), 0), count(*)::int,
    count(*) filter (where rating = 1)::int, count(*) filter (where rating = 2)::int,
    count(*) filter (where rating = 3)::int, count(*) filter (where rating = 4)::int,
    count(*) filter (where rating = 5)::int
  from public.product_reviews where product_id = p_product
$$;
grant execute on function public.product_rating_summary(uuid) to anon, authenticated;

drop function if exists public.product_reviews_list(uuid, int);
create function public.product_reviews_list(p_product uuid, p_limit int default 20)
returns table (id uuid, rating smallint, comment text, created_at timestamptz, reviewer text, avatar_url text, verified boolean, mine boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.comment, r.updated_at,
    split_part(coalesce(nullif(trim(p.full_name), ''), '—'), ' ', 1), p.avatar_url,
    exists (select 1 from public.orders o join public.order_items i on i.order_id = o.id
            where o.user_id = r.user_id and o.status = 'delivered' and i.product_id = r.product_id),
    r.user_id = auth.uid()
  from public.product_reviews r join public.profiles p on p.id = r.user_id
  where r.product_id = p_product
  order by (r.comment is not null) desc, r.updated_at desc
  limit least(greatest(p_limit, 1), 50)
$$;
grant execute on function public.product_reviews_list(uuid, int) to anon, authenticated;
