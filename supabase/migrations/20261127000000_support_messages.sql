-- Support inbox: registered members write to the company; admins read and answer.
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  reply text check (reply is null or length(reply) <= 2000),
  replied_by uuid references public.profiles(id) on delete set null,
  replied_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
create index if not exists support_messages_user_idx on public.support_messages(user_id, created_at desc);
create index if not exists support_messages_open_idx on public.support_messages(status, created_at desc);
alter table public.support_messages enable row level security;

create policy "support: read own or admin" on public.support_messages for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "support: member writes own" on public.support_messages for insert to authenticated
  with check (user_id = auth.uid() and reply is null and status = 'open'
              and not exists (select 1 from public.profiles where id = auth.uid() and blocked_at is not null));
create policy "support: admin answers" on public.support_messages for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "support: admin delete" on public.support_messages for delete to authenticated using (public.is_admin());
grant select, insert on public.support_messages to authenticated;
grant update (reply, replied_by, replied_at, status), delete on public.support_messages to authenticated;
grant all on public.support_messages to service_role;

-- at most 10 messages per member per day (spam guard)
create or replace function public.support_rate_limit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.support_messages where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many_messages';
  end if;
  return new;
end $$;
drop trigger if exists support_rate_limit on public.support_messages;
create trigger support_rate_limit before insert on public.support_messages for each row execute function public.support_rate_limit();

alter publication supabase_realtime add table public.support_messages;
