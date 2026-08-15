-- Personal Wine Cellar: atomic inventory operations

create or replace function public.require_authenticated_user()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  return v_user_id;
end;
$$;

create or replace function public.protect_cached_quantity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.current_quantity is distinct from old.current_quantity
    and current_user not in ('postgres', 'service_role') then
    raise exception 'Current quantity can only be changed through an inventory operation'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger wines_protect_cached_quantity
before update on public.wines
for each row execute function public.protect_cached_quantity();

create or replace function public.create_wine_with_initial_inventory(
  p_producer text default null,
  p_name text default null,
  p_vintage_year smallint default null,
  p_bottle_size_ml smallint default 750,
  p_country text default null,
  p_region text default null,
  p_appellation text default null,
  p_quantity integer default 1,
  p_drink_from_year smallint default null,
  p_drink_until_year smallint default null,
  p_shelf_id uuid default null,
  p_source text default null,
  p_purchase_price_pence integer default null,
  p_cellar_notes text default null,
  p_occurred_at timestamptz default now()
)
returns public.wines
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := public.require_authenticated_user();
  v_wine public.wines;
begin
  if p_quantity < 0 then
    raise exception 'Initial quantity cannot be negative' using errcode = '22023';
  end if;

  if p_shelf_id is not null and not exists (
    select 1 from public.shelves
    where id = p_shelf_id and user_id = v_user_id and is_active
  ) then
    raise exception 'Shelf not found' using errcode = '22023';
  end if;

  insert into public.wines (
    user_id,
    producer,
    name,
    vintage_year,
    bottle_size_ml,
    country,
    region,
    appellation,
    current_quantity,
    drink_from_year,
    drink_until_year,
    shelf_id,
    source,
    purchase_price_pence,
    cellar_notes
  ) values (
    v_user_id,
    nullif(btrim(p_producer), ''),
    nullif(btrim(p_name), ''),
    p_vintage_year,
    p_bottle_size_ml,
    nullif(btrim(p_country), ''),
    nullif(btrim(p_region), ''),
    nullif(btrim(p_appellation), ''),
    p_quantity,
    p_drink_from_year,
    p_drink_until_year,
    p_shelf_id,
    nullif(btrim(p_source), ''),
    p_purchase_price_pence,
    p_cellar_notes
  ) returning * into v_wine;

  if p_quantity > 0 then
    insert into public.inventory_transactions (
      user_id,
      wine_id,
      shelf_id,
      transaction_type,
      quantity_change,
      occurred_at,
      unit_price_pence,
      source
    ) values (
      v_user_id,
      v_wine.id,
      p_shelf_id,
      'initial_inventory',
      p_quantity,
      p_occurred_at,
      p_purchase_price_pence,
      nullif(btrim(p_source), '')
    );
  end if;

  return v_wine;
end;
$$;

create or replace function public.add_bottles(
  p_wine_id uuid,
  p_quantity integer,
  p_transaction_type public.inventory_transaction_type default 'purchased',
  p_occurred_at timestamptz default now(),
  p_unit_price_pence integer default null,
  p_source text default null,
  p_note text default null
)
returns public.wines
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := public.require_authenticated_user();
  v_wine public.wines;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity added must be greater than zero' using errcode = '22023';
  end if;

  if p_transaction_type not in ('purchased', 'gift', 'other_acquisition') then
    raise exception 'Invalid acquisition type' using errcode = '22023';
  end if;

  select * into v_wine
  from public.wines
  where id = p_wine_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wine not found' using errcode = 'P0002';
  end if;

  update public.wines
  set current_quantity = current_quantity + p_quantity
  where id = p_wine_id and user_id = v_user_id
  returning * into v_wine;

  insert into public.inventory_transactions (
    user_id,
    wine_id,
    shelf_id,
    transaction_type,
    quantity_change,
    occurred_at,
    unit_price_pence,
    source,
    note
  ) values (
    v_user_id,
    p_wine_id,
    v_wine.shelf_id,
    p_transaction_type,
    p_quantity,
    p_occurred_at,
    p_unit_price_pence,
    nullif(btrim(p_source), ''),
    p_note
  );

  return v_wine;
end;
$$;

create or replace function public.drink_one(
  p_wine_id uuid,
  p_drank_at timestamptz default now(),
  p_rating smallint default null,
  p_tasting_note text default null
)
returns public.drinking_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := public.require_authenticated_user();
  v_wine public.wines;
  v_event public.drinking_events;
begin
  select * into v_wine
  from public.wines
  where id = p_wine_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wine not found' using errcode = 'P0002';
  end if;

  if v_wine.current_quantity < 1 then
    raise exception 'No bottles remain' using errcode = '23514';
  end if;

  insert into public.drinking_events (
    user_id,
    wine_id,
    drank_at,
    rating,
    tasting_note,
    shelf_id
  ) values (
    v_user_id,
    p_wine_id,
    p_drank_at,
    p_rating,
    p_tasting_note,
    v_wine.shelf_id
  ) returning * into v_event;

  insert into public.inventory_transactions (
    user_id,
    wine_id,
    shelf_id,
    transaction_type,
    quantity_change,
    occurred_at,
    drinking_event_id
  ) values (
    v_user_id,
    p_wine_id,
    v_wine.shelf_id,
    'drank',
    -1,
    p_drank_at,
    v_event.id
  );

  update public.wines
  set current_quantity = current_quantity - 1
  where id = p_wine_id and user_id = v_user_id;

  return v_event;
end;
$$;

create or replace function public.adjust_inventory(
  p_wine_id uuid,
  p_quantity_change integer,
  p_occurred_at timestamptz default now(),
  p_note text default null
)
returns public.wines
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := public.require_authenticated_user();
  v_wine public.wines;
begin
  if p_quantity_change = 0 then
    raise exception 'Adjustment cannot be zero' using errcode = '22023';
  end if;

  select * into v_wine
  from public.wines
  where id = p_wine_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wine not found' using errcode = 'P0002';
  end if;

  if v_wine.current_quantity + p_quantity_change < 0 then
    raise exception 'Adjustment would reduce quantity below zero' using errcode = '23514';
  end if;

  update public.wines
  set current_quantity = current_quantity + p_quantity_change
  where id = p_wine_id and user_id = v_user_id
  returning * into v_wine;

  insert into public.inventory_transactions (
    user_id,
    wine_id,
    shelf_id,
    transaction_type,
    quantity_change,
    occurred_at,
    note
  ) values (
    v_user_id,
    p_wine_id,
    v_wine.shelf_id,
    'manual_adjustment',
    p_quantity_change,
    p_occurred_at,
    p_note
  );

  return v_wine;
end;
$$;

revoke all on function public.require_authenticated_user() from public, anon;
revoke all on function public.create_wine_with_initial_inventory(
  text, text, smallint, smallint, text, text, text, integer, smallint,
  smallint, uuid, text, integer, text, timestamptz
) from public, anon;
revoke all on function public.add_bottles(
  uuid, integer, public.inventory_transaction_type, timestamptz, integer, text, text
) from public, anon;
revoke all on function public.drink_one(uuid, timestamptz, smallint, text)
  from public, anon;
revoke all on function public.adjust_inventory(uuid, integer, timestamptz, text)
  from public, anon;

grant execute on function public.create_wine_with_initial_inventory(
  text, text, smallint, smallint, text, text, text, integer, smallint,
  smallint, uuid, text, integer, text, timestamptz
) to authenticated;
grant execute on function public.add_bottles(
  uuid, integer, public.inventory_transaction_type, timestamptz, integer, text, text
) to authenticated;
grant execute on function public.drink_one(uuid, timestamptz, smallint, text)
  to authenticated;
grant execute on function public.adjust_inventory(uuid, integer, timestamptz, text)
  to authenticated;
