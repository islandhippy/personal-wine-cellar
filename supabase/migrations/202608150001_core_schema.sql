-- Personal Wine Cellar: core schema
-- One authenticated owner, one EuroCave fridge, six configurable shelves.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.wine_status as enum ('active', 'archived');
create type public.image_type as enum ('front', 'back');
create type public.inventory_transaction_type as enum (
  'initial_inventory',
  'purchased',
  'gift',
  'other_acquisition',
  'drank',
  'manual_adjustment'
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Europe/London',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shelves (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  name text not null,
  position smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shelves_name_not_blank check (btrim(name) <> ''),
  constraint shelves_position_positive check (position > 0),
  constraint shelves_id_user_unique unique (id, user_id),
  constraint shelves_user_name_unique unique (user_id, name),
  constraint shelves_user_position_unique unique (user_id, position)
);

create table public.wines (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  producer text,
  name text,
  vintage_year smallint,
  bottle_size_ml smallint not null default 750,
  country text,
  region text,
  appellation text,
  current_quantity integer not null default 0,
  drink_from_year smallint,
  drink_until_year smallint,
  shelf_id uuid,
  source text,
  purchase_price_pence integer,
  cellar_notes text,
  status public.wine_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wines_id_user_unique unique (id, user_id),
  constraint wines_shelf_owned foreign key (shelf_id, user_id)
    references public.shelves (id, user_id) on delete restrict,
  constraint wines_vintage_plausible check (
    vintage_year is null or vintage_year between 1000 and 2100
  ),
  constraint wines_bottle_size_supported check (bottle_size_ml in (375, 750)),
  constraint wines_quantity_nonnegative check (current_quantity >= 0),
  constraint wines_drink_from_plausible check (
    drink_from_year is null or drink_from_year between 1000 and 2200
  ),
  constraint wines_drink_until_plausible check (
    drink_until_year is null or drink_until_year between 1000 and 2200
  ),
  constraint wines_drinking_window_order check (
    drink_from_year is null
    or drink_until_year is null
    or drink_until_year >= drink_from_year
  ),
  constraint wines_purchase_price_nonnegative check (
    purchase_price_pence is null or purchase_price_pence >= 0
  )
);

create table public.grape_varieties (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint grape_varieties_name_not_blank check (btrim(name) <> ''),
  constraint grape_varieties_id_user_unique unique (id, user_id)
);

create unique index grape_varieties_user_name_ci_unique
  on public.grape_varieties (user_id, lower(name));

create table public.wine_grape_varieties (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  wine_id uuid not null,
  grape_variety_id uuid not null,
  percentage numeric(5, 2),
  created_at timestamptz not null default now(),
  primary key (wine_id, grape_variety_id),
  constraint wine_grapes_wine_owned foreign key (wine_id, user_id)
    references public.wines (id, user_id) on delete cascade,
  constraint wine_grapes_grape_owned foreign key (grape_variety_id, user_id)
    references public.grape_varieties (id, user_id) on delete restrict,
  constraint wine_grapes_percentage_valid check (
    percentage is null or percentage > 0 and percentage <= 100
  )
);

create table public.drinking_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  wine_id uuid not null,
  drank_at timestamptz not null default now(),
  rating smallint,
  tasting_note text,
  shelf_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drinking_events_id_user_unique unique (id, user_id),
  constraint drinking_events_wine_owned foreign key (wine_id, user_id)
    references public.wines (id, user_id) on delete restrict,
  constraint drinking_events_shelf_owned foreign key (shelf_id, user_id)
    references public.shelves (id, user_id) on delete restrict,
  constraint drinking_events_rating_valid check (rating is null or rating between 1 and 10)
);

create table public.inventory_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  wine_id uuid not null,
  shelf_id uuid,
  transaction_type public.inventory_transaction_type not null,
  quantity_change integer not null,
  occurred_at timestamptz not null default now(),
  unit_price_pence integer,
  source text,
  note text,
  drinking_event_id uuid,
  created_at timestamptz not null default now(),
  constraint inventory_transactions_wine_owned foreign key (wine_id, user_id)
    references public.wines (id, user_id) on delete restrict,
  constraint inventory_transactions_shelf_owned foreign key (shelf_id, user_id)
    references public.shelves (id, user_id) on delete restrict,
  constraint inventory_transactions_event_owned foreign key (drinking_event_id, user_id)
    references public.drinking_events (id, user_id) on delete restrict,
  constraint inventory_transactions_quantity_nonzero check (quantity_change <> 0),
  constraint inventory_transactions_price_nonnegative check (
    unit_price_pence is null or unit_price_pence >= 0
  ),
  constraint inventory_transactions_type_direction check (
    (transaction_type in ('initial_inventory', 'purchased', 'gift', 'other_acquisition')
      and quantity_change > 0)
    or (transaction_type = 'drank' and quantity_change = -1)
    or (transaction_type = 'manual_adjustment' and quantity_change <> 0)
  ),
  constraint inventory_transactions_drink_event_match check (
    (transaction_type = 'drank' and drinking_event_id is not null)
    or (transaction_type <> 'drank' and drinking_event_id is null)
  )
);

create unique index inventory_transactions_one_per_drinking_event
  on public.inventory_transactions (drinking_event_id)
  where drinking_event_id is not null;

create table public.wine_images (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  wine_id uuid not null,
  image_type public.image_type not null,
  storage_path text not null,
  original_filename text,
  mime_type text not null,
  width integer,
  height integer,
  file_size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wine_images_wine_owned foreign key (wine_id, user_id)
    references public.wines (id, user_id) on delete cascade,
  constraint wine_images_storage_path_not_blank check (btrim(storage_path) <> ''),
  constraint wine_images_dimensions_positive check (
    (width is null or width > 0) and (height is null or height > 0)
  ),
  constraint wine_images_file_size_nonnegative check (
    file_size_bytes is null or file_size_bytes >= 0
  ),
  constraint wine_images_one_type_per_wine unique (wine_id, image_type),
  constraint wine_images_storage_path_unique unique (storage_path)
);

create index wines_user_active_idx
  on public.wines (user_id, status, updated_at desc);
create index wines_user_shelf_idx
  on public.wines (user_id, shelf_id);
create index wines_user_vintage_idx
  on public.wines (user_id, vintage_year);
create index wines_user_drink_until_idx
  on public.wines (user_id, drink_until_year)
  where current_quantity > 0 and drink_until_year is not null;
create index wines_producer_trgm_idx
  on public.wines using gin (producer extensions.gin_trgm_ops);
create index wines_name_trgm_idx
  on public.wines using gin (name extensions.gin_trgm_ops);
create index wines_region_trgm_idx
  on public.wines using gin (region extensions.gin_trgm_ops);
create index drinking_events_wine_date_idx
  on public.drinking_events (wine_id, drank_at desc);
create index inventory_transactions_wine_date_idx
  on public.inventory_transactions (wine_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger shelves_set_updated_at
before update on public.shelves
for each row execute function public.set_updated_at();

create trigger wines_set_updated_at
before update on public.wines
for each row execute function public.set_updated_at();

create trigger drinking_events_set_updated_at
before update on public.drinking_events
for each row execute function public.set_updated_at();

create trigger wine_images_set_updated_at
before update on public.wine_images
for each row execute function public.set_updated_at();

comment on column public.wines.current_quantity is
  'Cached balance maintained only by inventory functions; the transaction ledger remains auditable.';
comment on column public.wines.purchase_price_pence is
  'Optional reference price per bottle in GBP pennies.';
comment on column public.inventory_transactions.unit_price_pence is
  'Optional price per bottle in GBP pennies.';
