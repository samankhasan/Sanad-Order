-- Rewards: a gift / prize the company gives to one member (title, text, optional picture).
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  body text check (body is null or length(body) <= 1000),
  image_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists rewards_user_idx on public.rewards(user_id, created_at desc);
alter table public.rewards enable row level security;
create policy "rewards: read own or admin" on public.rewards for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "rewards: admin insert" on public.rewards for insert to authenticated with check (public.is_admin());
create policy "rewards: admin update" on public.rewards for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "rewards: admin delete" on public.rewards for delete to authenticated using (public.is_admin());
grant select, insert, update, delete on public.rewards to authenticated;
grant all on public.rewards to service_role;

-- Challenges announced by the company; members join; progress is counted from their orders.
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  description text check (description is null or length(description) <= 2000),
  image_url text,
  reward_text text check (reward_text is null or length(reward_text) <= 300),
  goal_type text not null default 'orders_count' check (goal_type in ('orders_count', 'spend_total', 'custom')),
  goal_value numeric(14,2) check (goal_value is null or goal_value > 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (goal_type = 'custom' or goal_value is not null)
);
create index if not exists challenges_dates_idx on public.challenges(ends_at desc);
alter table public.challenges enable row level security;
create policy "challenges: members read published" on public.challenges for select to authenticated using (is_active or public.is_admin());
create policy "challenges: admin write" on public.challenges for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.challenges to authenticated;
grant all on public.challenges to service_role;

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (challenge_id, user_id)
);
create index if not exists challenge_participants_user_idx on public.challenge_participants(user_id);
alter table public.challenge_participants enable row level security;
create policy "participants: read own or admin" on public.challenge_participants for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- members join only running, published challenges and never set completion themselves
create policy "participants: member joins running" on public.challenge_participants for insert to authenticated
  with check (user_id = auth.uid() and completed_at is null
    and exists (select 1 from public.challenges c where c.id = challenge_id and c.is_active and now() between c.starts_at and c.ends_at)
    and not exists (select 1 from public.profiles where id = auth.uid() and blocked_at is not null));
create policy "participants: member leaves" on public.challenge_participants for delete to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "participants: admin update" on public.challenge_participants for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, delete on public.challenge_participants to authenticated;
grant update (completed_at) on public.challenge_participants to authenticated;
grant all on public.challenge_participants to service_role;

-- progress of one member in one challenge (orders placed inside the challenge window, cancelled excluded)
create or replace function public.challenge_progress(p_challenge uuid, p_user uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select case c.goal_type
    when 'orders_count' then (select count(*)::numeric from public.orders o where o.user_id = p_user and o.status <> 'cancelled' and o.created_at between c.starts_at and c.ends_at)
    when 'spend_total' then (select coalesce(sum(o.total), 0) from public.orders o where o.user_id = p_user and o.status <> 'cancelled' and o.created_at between c.starts_at and c.ends_at)
    else 0 end
  from public.challenges c where c.id = p_challenge
$$;
revoke all on function public.challenge_progress(uuid, uuid) from public, anon, authenticated;

-- everything the member's Challenges screen needs, in one call
create or replace function public.my_challenges()
returns table (id uuid, title text, description text, image_url text, reward_text text, goal_type text, goal_value numeric,
               starts_at timestamptz, ends_at timestamptz, joined boolean, progress numeric, completed boolean, participants int)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.description, c.image_url, c.reward_text, c.goal_type, c.goal_value, c.starts_at, c.ends_at,
         p.user_id is not null as joined,
         case when p.user_id is null then 0 else public.challenge_progress(c.id, auth.uid()) end as progress,
         (p.completed_at is not null or (p.user_id is not null and c.goal_type <> 'custom' and public.challenge_progress(c.id, auth.uid()) >= c.goal_value)) as completed,
         (select count(*)::int from public.challenge_participants x where x.challenge_id = c.id) as participants
  from public.challenges c
  left join public.challenge_participants p on p.challenge_id = c.id and p.user_id = auth.uid()
  where c.is_active and c.starts_at <= now() + interval '30 days'
  order by c.ends_at desc
$$;
revoke all on function public.my_challenges() from public, anon;
grant execute on function public.my_challenges() to authenticated;

-- admin: participants of a challenge with their progress (leaderboard)
create or replace function public.challenge_leaderboard(p_challenge uuid)
returns table (user_id uuid, full_name text, phone text, avatar_url text, joined_at timestamptz, completed_at timestamptz, progress numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.user_id, pr.full_name, pr.phone, pr.avatar_url, p.joined_at, p.completed_at, public.challenge_progress(p.challenge_id, p.user_id)
    from public.challenge_participants p join public.profiles pr on pr.id = p.user_id
    where p.challenge_id = p_challenge
    order by 7 desc, p.joined_at;
end $$;
revoke all on function public.challenge_leaderboard(uuid) from public, anon;
grant execute on function public.challenge_leaderboard(uuid) to authenticated;

alter publication supabase_realtime add table public.rewards;
