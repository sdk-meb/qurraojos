alter table public.products
  add column if not exists feed_item_id text,
  add column if not exists brand text,
  add column if not exists condition text,
  add column if not exists product_url text,
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists regular_price_mad integer,
  add column if not exists sale_price_mad integer,
  add column if not exists quantity_to_sell_on_facebook integer,
  add column if not exists feed_attributes jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_regular_price_mad_check' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_regular_price_mad_check
      check (regular_price_mad is null or regular_price_mad between 10 and 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_sale_price_mad_check' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_sale_price_mad_check
      check (sale_price_mad is null or sale_price_mad between 10 and 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_quantity_to_sell_check' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_quantity_to_sell_check
      check (quantity_to_sell_on_facebook is null or quantity_to_sell_on_facebook >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_feed_attributes_object_check' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_feed_attributes_object_check
      check (jsonb_typeof(feed_attributes) = 'object');
  end if;
end;
$$;
