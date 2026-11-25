-- device push tokens (FCM) — one row per device
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('android','ios','web')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;
create policy "push_tokens: own insert" on public.push_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "push_tokens: own update" on public.push_tokens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_tokens: own read or admin" on public.push_tokens for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "push_tokens: own delete" on public.push_tokens for delete to authenticated using (user_id = auth.uid());

-- in-app notification inbox (broadcasts, and optionally per-user)
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  body text not null check (length(body) between 1 and 1000),
  image_url text,
  link text,
  target_user uuid references public.profiles(id) on delete cascade, -- null = everyone
  created_by uuid references public.profiles(id) on delete set null,
  push_sent int not null default 0,
  push_failed int not null default 0,
  created_at timestamptz not null default now()
);
create index notifications_created_idx on public.notifications(created_at desc);
create index notifications_target_idx on public.notifications(target_user);
create index notifications_created_by_idx on public.notifications(created_by);
alter table public.notifications enable row level security;
create policy "notifications: read mine/broadcast" on public.notifications for select to authenticated
  using (target_user is null or target_user = auth.uid() or public.is_admin());
create policy "notifications: admin insert" on public.notifications for insert to authenticated with check (public.is_admin());
create policy "notifications: admin update" on public.notifications for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "notifications: admin delete" on public.notifications for delete to authenticated using (public.is_admin());

alter table public.profiles add column notifications_seen_at timestamptz not null default now();
alter table public.profiles add column lang text not null default 'ku' check (lang in ('ku','ar','en'));

alter publication supabase_realtime add table public.notifications;
