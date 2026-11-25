-- Admin drag & drop: save the new order of products in one call (position = index in the array)
create or replace function public.reorder_products(p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.products p set sort_order = x.pos
  from unnest(p_ids) with ordinality as x(id, pos)
  where p.id = x.id;
end $$;
revoke all on function public.reorder_products(uuid[]) from public, anon;
grant execute on function public.reorder_products(uuid[]) to authenticated;
