-- Allow a diary memory from before inventory tracking without changing quantity.

alter table public.drinking_events
  add column date_known boolean not null default true;

comment on column public.drinking_events.date_known is
  'False when the historical tasting date was not remembered; drank_at then provides internal ordering only.';

create or replace function public.record_past_tasting(
  p_wine_id uuid,
  p_drank_at timestamptz default null,
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
  where id = p_wine_id and user_id = v_user_id;

  if not found then
    raise exception 'Wine not found' using errcode = 'P0002';
  end if;

  if p_rating is null and nullif(btrim(p_tasting_note), '') is null then
    raise exception 'Add a rating or tasting note' using errcode = '22023';
  end if;

  insert into public.drinking_events (
    user_id,
    wine_id,
    drank_at,
    date_known,
    rating,
    tasting_note,
    shelf_id
  ) values (
    v_user_id,
    p_wine_id,
    coalesce(p_drank_at, now()),
    p_drank_at is not null,
    p_rating,
    nullif(btrim(p_tasting_note), ''),
    v_wine.shelf_id
  ) returning * into v_event;

  return v_event;
end;
$$;

revoke all on function public.record_past_tasting(uuid, timestamptz, smallint, text)
  from public, anon;
grant execute on function public.record_past_tasting(uuid, timestamptz, smallint, text)
  to authenticated;
