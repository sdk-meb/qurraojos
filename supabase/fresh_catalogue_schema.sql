-- Core schema for a fresh Supabase project.
-- Run store_categories.sql afterward to seed category and color reference data.

begin;

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id text primary key,
  name jsonb not null check (
    jsonb_typeof(name) = 'object'
    and length(trim(coalesce(name ->> 'ar', ''))) > 0
  ),
  description jsonb not null default '{}'::jsonb
    check (jsonb_typeof(description) = 'object'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.colors (
  id text primary key check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label jsonb not null check (
    jsonb_typeof(label) = 'object'
    and length(trim(coalesce(label ->> 'ar', ''))) > 0
    and length(trim(coalesce(label ->> 'en', ''))) > 0
  ),
  hex_color text not null check (hex_color ~ '^#[0-9A-Fa-f]{6}$'),
  aliases text[] not null default '{}',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category_id text not null
    references public.categories(id) on update cascade,
  name jsonb not null check (
    jsonb_typeof(name) = 'object'
    and length(trim(coalesce(name ->> 'ar', ''))) > 0
  ),
  description jsonb not null default '{}'::jsonb
    check (jsonb_typeof(description) = 'object'),
  price_mad integer not null check (price_mad between 10 and 300),
  available boolean not null default true,
  feed_item_id text unique,
  brand text,
  condition text check (condition is null or condition in ('new', 'used')),
  google_product_category text,
  fb_product_category text,
  age_group text,
  material text,
  regular_price_mad integer
    check (regular_price_mad is null or regular_price_mad between 10 and 300),
  sale_price_mad integer
    check (sale_price_mad is null or sale_price_mad between 10 and 300),
  quantity_to_sell_on_facebook integer
    check (quantity_to_sell_on_facebook is null or quantity_to_sell_on_facebook >= 1),
  feed_attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(feed_attributes) = 'object'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_color_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.products(id) on delete cascade,
  color_id text not null references public.colors(id),
  feed_item_id text unique,
  available boolean not null default true,
  price_mad integer check (price_mad is null or price_mad between 10 and 300),
  source_title text,
  source_description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_color_options_product_color_key
    unique (product_id, color_id),
  constraint product_color_options_product_id_id_key
    unique (product_id, id)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.products(id) on delete cascade,
  color_option_id uuid,
  image_url text not null check (length(trim(image_url)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_images_color_option_same_product_fk
    foreign key (product_id, color_option_id)
    references public.product_color_options(product_id, id) on delete cascade,
  constraint product_images_product_scope_url_key
    unique nulls not distinct (product_id, color_option_id, image_url)
);

create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_available_idx on public.products (available);
create index if not exists product_color_options_product_id_idx
  on public.product_color_options (product_id);
create index if not exists product_color_options_color_id_idx
  on public.product_color_options (color_id);
create index if not exists product_images_product_scope_order_idx
  on public.product_images (product_id, color_option_id, sort_order);

create or replace function public.set_product_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_product_updated_at();

alter table public.categories enable row level security;
alter table public.colors enable row level security;
alter table public.products enable row level security;
alter table public.product_color_options enable row level security;
alter table public.product_images enable row level security;

grant select on public.categories, public.colors, public.products,
  public.product_color_options, public.product_images
  to anon, authenticated;
grant insert, update, delete
  on public.categories, public.products, public.product_color_options,
  public.product_images
  to authenticated;

drop policy if exists "Categories are visible to everyone" on public.categories;
drop policy if exists "Colors are visible to everyone" on public.colors;
drop policy if exists "Products are visible to everyone" on public.products;
drop policy if exists "Product colors are visible to everyone"
  on public.product_color_options;
drop policy if exists "Product images are visible to everyone" on public.product_images;
drop policy if exists "Store owner manages categories" on public.categories;
drop policy if exists "Store owner manages products" on public.products;
drop policy if exists "Store owner manages product colors"
  on public.product_color_options;
drop policy if exists "Store owner manages product images" on public.product_images;

create policy "Categories are visible to everyone"
  on public.categories for select using (true);
create policy "Colors are visible to everyone"
  on public.colors for select using (active);
create policy "Products are visible to everyone"
  on public.products for select using (true);
create policy "Product colors are visible to everyone"
  on public.product_color_options for select using (true);
create policy "Product images are visible to everyone"
  on public.product_images for select using (true);

create policy "Store owner manages categories"
  on public.categories for all
  using ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true')
  with check ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true');
create policy "Store owner manages products"
  on public.products for all
  using ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true')
  with check ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true');
create policy "Store owner manages product colors"
  on public.product_color_options for all
  using ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true')
  with check ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true');
create policy "Store owner manages product images"
  on public.product_images for all
  using ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true')
  with check ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

drop policy if exists "Product images are public" on storage.objects;
drop policy if exists "Store owner uploads product images" on storage.objects;
drop policy if exists "Store owner updates product images" on storage.objects;
drop policy if exists "Store owner deletes product images" on storage.objects;

create policy "Product images are public"
  on storage.objects for select
  using (bucket_id = 'product-images');
create policy "Store owner uploads product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true'
  );
create policy "Store owner updates product images"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true'
  )
  with check (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true'
  );
create policy "Store owner deletes product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true'
  );

commit;
