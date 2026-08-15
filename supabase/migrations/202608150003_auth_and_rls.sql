-- Personal Wine Cellar: sole-user bootstrap and row-level security

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.shelves (user_id, name, position)
  select new.id, 'Shelf ' || shelf_number, shelf_number
  from generate_series(1, 6) as shelf_number
  on conflict (user_id, position) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Also initialise an account if it was created before these migrations ran.
insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

insert into public.shelves (user_id, name, position)
select auth_user.id, 'Shelf ' || shelf_number, shelf_number
from auth.users as auth_user
cross join generate_series(1, 6) as shelf_number
on conflict (user_id, position) do nothing;

alter table public.profiles enable row level security;
alter table public.shelves enable row level security;
alter table public.wines enable row level security;
alter table public.grape_varieties enable row level security;
alter table public.wine_grape_varieties enable row level security;
alter table public.drinking_events enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.wine_images enable row level security;

create policy profiles_select_own
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_update_own
on public.profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy shelves_select_own
on public.shelves for select
to authenticated
using ((select auth.uid()) = user_id);

create policy shelves_insert_own
on public.shelves for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy shelves_update_own
on public.shelves for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy shelves_delete_own
on public.shelves for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy wines_select_own
on public.wines for select
to authenticated
using ((select auth.uid()) = user_id);

create policy wines_update_own
on public.wines for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy grape_varieties_all_own
on public.grape_varieties for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy wine_grape_varieties_all_own
on public.wine_grape_varieties for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy drinking_events_select_own
on public.drinking_events for select
to authenticated
using ((select auth.uid()) = user_id);

create policy drinking_events_update_own
on public.drinking_events for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy inventory_transactions_select_own
on public.inventory_transactions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy wine_images_all_own
on public.wine_images for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.shelves to authenticated;
grant select, update on public.wines to authenticated;
grant select, insert, update, delete on public.grape_varieties to authenticated;
grant select, insert, update, delete on public.wine_grape_varieties to authenticated;
grant select, update on public.drinking_events to authenticated;
grant select on public.inventory_transactions to authenticated;
grant select, insert, update, delete on public.wine_images to authenticated;
