-- Product ratings (1–5 stars, optional comment). A member can rate a product once it was delivered to them;
-- one rating per member per product (rating again updates it). Products keep the average for fast lists.
alter table public.products add column if not exists rating_avg numeric(3,2) not null default 0;
alter table public.products add column if not exists rating_count int not null default 0;

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists product_reviews_product_idx on public.product_reviews(product_id, created_at desc);
alter table public.product_reviews enable row level security;

-- true when this member received (delivered order) the product
create or replace function public.can_review(p_product uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o join public.order_items i on i.order_id = o.id
    where o.user_id = auth.uid() and o.status = 'delivered' and i.product_id = p_product)
  and not exists (select 1 from public.profiles where id = auth.uid() and blocked_at is not null)
$$;
grant execute on function public.can_review(uuid) to authenticated;

create policy "reviews: read own or admin" on public.product_reviews for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "reviews: write own after delivery" on public.product_reviews for insert to authenticated
  with check (user_id = auth.uid() and public.can_review(product_id));
create policy "reviews: update own" on public.product_reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_review(product_id));
create policy "reviews: delete own or admin" on public.product_reviews for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
grant select, insert, update, delete on public.product_reviews to authenticated;
grant all on public.product_reviews to service_role;

-- keep products.rating_avg / rating_count in sync
create or replace function public.refresh_product_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.product_reviews where product_id = pid), 0),
    rating_count = (select count(*) from public.product_reviews where product_id = pid)
  where p.id = pid;
  return null;
end $$;
drop trigger if exists product_reviews_rating on public.product_reviews;
create trigger product_reviews_rating after insert or update or delete on public.product_reviews
  for each row execute function public.refresh_product_rating();

-- public list for a product page: rating, comment, date and the reviewer's first name / photo only
create or replace function public.product_reviews_list(p_product uuid, p_limit int default 20)
returns table (rating smallint, comment text, created_at timestamptz, reviewer text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select r.rating, r.comment, r.updated_at, split_part(coalesce(nullif(trim(p.full_name), ''), '—'), ' ', 1), p.avatar_url
  from public.product_reviews r join public.profiles p on p.id = r.user_id
  where r.product_id = p_product
  order by (r.comment is not null) desc, r.updated_at desc
  limit least(greatest(p_limit, 1), 50)
$$;
grant execute on function public.product_reviews_list(uuid, int) to anon, authenticated;
