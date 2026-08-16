-- Add one optional principal wine type without changing existing records.

alter table public.wines add column wine_type text;

alter table public.wines
add constraint wines_type_supported check (
  wine_type is null
  or wine_type in ('Red', 'White', 'Rosé', 'Sparkling', 'Sweet', 'Fortified')
);

create index wines_user_type_idx
  on public.wines (user_id, wine_type)
  where wine_type is not null;

drop function public.create_wine_with_initial_inventory(
  text, text, smallint, smallint, text, text, text, integer, smallint,
  smallint, uuid, text, integer, text, timestamptz
);

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
  p_occurred_at timestamptz default now(),
  p_wine_type text default null
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

  if p_wine_type is not null
    and p_wine_type not in ('Red', 'White', 'Rosé', 'Sparkling', 'Sweet', 'Fortified') then
    raise exception 'Invalid wine type' using errcode = '22023';
  end if;

  insert into public.wines (
    user_id, producer, name, vintage_year, bottle_size_ml, country, region,
    appellation, current_quantity, drink_from_year, drink_until_year,
    shelf_id, source, purchase_price_pence, cellar_notes, wine_type
  ) values (
    v_user_id, nullif(btrim(p_producer), ''), nullif(btrim(p_name), ''),
    p_vintage_year, p_bottle_size_ml, nullif(btrim(p_country), ''),
    nullif(btrim(p_region), ''), nullif(btrim(p_appellation), ''), p_quantity,
    p_drink_from_year, p_drink_until_year, p_shelf_id,
    nullif(btrim(p_source), ''), p_purchase_price_pence, p_cellar_notes,
    nullif(btrim(p_wine_type), '')
  ) returning * into v_wine;

  if p_quantity > 0 then
    insert into public.inventory_transactions (
      user_id, wine_id, shelf_id, transaction_type, quantity_change,
      occurred_at, unit_price_pence, source
    ) values (
      v_user_id, v_wine.id, p_shelf_id, 'initial_inventory', p_quantity,
      p_occurred_at, p_purchase_price_pence, nullif(btrim(p_source), '')
    );
  end if;

  return v_wine;
end;
$$;

revoke all on function public.create_wine_with_initial_inventory(
  text, text, smallint, smallint, text, text, text, integer, smallint,
  smallint, uuid, text, integer, text, timestamptz, text
) from public, anon;

grant execute on function public.create_wine_with_initial_inventory(
  text, text, smallint, smallint, text, text, text, integer, smallint,
  smallint, uuid, text, integer, text, timestamptz, text
) to authenticated;
