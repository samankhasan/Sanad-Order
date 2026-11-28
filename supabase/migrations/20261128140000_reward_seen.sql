-- A member sees a celebration pop-up for each new reward until they open it; seen_at records that.
alter table public.rewards add column if not exists seen_at timestamptz;
-- members may only set seen_at on their own rewards; admins keep full update rights through the policy below
revoke update on public.rewards from authenticated;
grant update (seen_at) on public.rewards to authenticated;
drop policy if exists "rewards: member marks seen" on public.rewards;
create policy "rewards: member marks seen" on public.rewards for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- rewards already given before this change count as seen
update public.rewards set seen_at = created_at where seen_at is null and created_at < now() - interval '7 days';
