-- This project does not auto-grant table privileges to the API roles; grant explicitly.
-- Row Level Security policies still decide which rows each user can touch.

-- backend (edge functions)
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- catalogue: everyone reads, admins write (RLS)
grant select on public.categories, public.products to anon, authenticated;
grant insert, update, delete on public.categories, public.products to authenticated;

-- profiles: read/update own (admins all, via RLS)
grant select, update on public.profiles to authenticated;

-- orders: created only through place_order(); read own; admins update/delete (RLS)
grant select, update, delete on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- notifications & push tokens
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;

-- admin_emails stays private (no grants to anon/authenticated)
