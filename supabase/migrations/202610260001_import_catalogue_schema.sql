-- Upgrade an existing catalogue to the schema expected by the CSV importer.
-- For an empty project, use fresh_catalogue_schema.sql instead.

begin;

create extension if not exists pgcrypto;

alter table public.products
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists feed_item_id text,
  add column if not exists brand text,
  add column if not exists condition text,
  add column if not exists product_url text,
  add column if not exists google_product_category text,
  add column if not exists fb_product_category text,
  add column if not exists age_group text,
  add column if not exists material text,
  add column if not exists regular_price_mad integer,
  add column if not exists sale_price_mad integer,
  add column if not exists quantity_to_sell_on_facebook integer,
  add column if not exists feed_attributes jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_condition_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint products_condition_check
      check (condition is null or condition in ('new', 'used'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_regular_price_mad_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint products_regular_price_mad_check
      check (regular_price_mad is null or regular_price_mad between 10 and 300);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_sale_price_mad_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint products_sale_price_mad_check
      check (sale_price_mad is null or sale_price_mad between 10 and 300);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_quantity_to_sell_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint products_quantity_to_sell_check
      check (quantity_to_sell_on_facebook is null or quantity_to_sell_on_facebook >= 1);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_feed_attributes_object_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint products_feed_attributes_object_check
      check (jsonb_typeof(feed_attributes) = 'object');
  end if;
end;
$$;

create table if not exists public.product_color_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.products(id) on delete cascade,
  feed_item_id text unique,
  color text not null check (length(trim(color)) > 0),
  color_key text not null
    check (color_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label jsonb not null check (
    jsonb_typeof(label) = 'object'
    and length(trim(coalesce(label ->> 'ar', ''))) > 0
  ),
  available boolean not null default true,
  price_mad integer check (price_mad is null or price_mad between 10 and 300),
  image_url text,
  image_urls text[] not null default '{}',
  source_title text,
  source_description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_color_options_product_color_key
    unique (product_id, color_key)
);

create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_available_idx on public.products (available);
create index if not exists product_color_options_product_id_idx
  on public.product_color_options (product_id);
create index if not exists product_color_options_color_idx
  on public.product_color_options (color);

alter table public.product_color_options enable row level security;

grant select on public.product_color_options to anon, authenticated;
grant insert, update, delete on public.product_color_options to authenticated;

drop policy if exists "Product colors are visible to everyone"
  on public.product_color_options;
drop policy if exists "Store owner manages product colors"
  on public.product_color_options;

create policy "Product colors are visible to everyone"
  on public.product_color_options for select using (true);
create policy "Store owner manages product colors"
  on public.product_color_options for all
  using ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true')
  with check ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true');

commit;
