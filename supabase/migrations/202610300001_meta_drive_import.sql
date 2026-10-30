-- Enforce the import workflow's global product-image URL uniqueness.
-- Resolve existing duplicate URLs before applying this migration.
begin;

do $$
begin
  if exists (
    select 1
    from public.product_images
    group by image_url
    having count(*) > 1
  ) then
    raise exception
      'Duplicate product image URLs exist. Resolve them before applying the Meta + Drive import migration.';
  end if;
end;
$$;

create unique index if not exists product_images_image_url_global_key
  on public.product_images (image_url);

create or replace function public.save_reviewed_catalogue(
  p_products jsonb,
  p_color_options jsonb,
  p_product_images jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  product_count integer;
  option_count integer;
  image_count integer;
  duplicate_feed_item_id text;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'store_owner', 'false') <> 'true' then
    raise exception 'Only the configured store owner can import reviewed catalogue records.';
  end if;
  if jsonb_typeof(p_products) is distinct from 'array'
    or jsonb_typeof(p_color_options) is distinct from 'array'
    or jsonb_typeof(p_product_images) is distinct from 'array' then
    raise exception 'Catalogue import parameters must be JSON arrays.';
  end if;

  insert into public.products (
    id, slug, category_id, name, description, price_mad, available, feed_item_id,
    brand, condition, google_product_category, fb_product_category, age_group,
    material, regular_price_mad, sale_price_mad, quantity_to_sell_on_facebook,
    feed_attributes, sort_order
  )
  select
    row_data.id, row_data.slug, row_data.category_id, row_data.name, row_data.description,
    row_data.price_mad, row_data.available, row_data.feed_item_id, row_data.brand,
    row_data.condition, row_data.google_product_category, row_data.fb_product_category,
    row_data.age_group, row_data.material, row_data.regular_price_mad, row_data.sale_price_mad,
    row_data.quantity_to_sell_on_facebook, row_data.feed_attributes, row_data.sort_order
  from jsonb_populate_recordset(null::public.products, p_products) as row_data
  on conflict (slug) do update set
    category_id = excluded.category_id,
    name = excluded.name,
    description = excluded.description,
    price_mad = excluded.price_mad,
    available = excluded.available,
    feed_item_id = excluded.feed_item_id,
    brand = excluded.brand,
    condition = excluded.condition,
    google_product_category = excluded.google_product_category,
    fb_product_category = excluded.fb_product_category,
    age_group = excluded.age_group,
    material = excluded.material,
    regular_price_mad = excluded.regular_price_mad,
    sale_price_mad = excluded.sale_price_mad,
    quantity_to_sell_on_facebook = excluded.quantity_to_sell_on_facebook,
    feed_attributes = excluded.feed_attributes,
    sort_order = excluded.sort_order;
  get diagnostics product_count = row_count;

  insert into public.product_color_options (
    id, product_id, color_id, feed_item_id, available, price_mad,
    source_title, source_description, sort_order
  )
  select
    row_data.id, row_data.product_id, row_data.color_id, row_data.feed_item_id,
    row_data.available, row_data.price_mad, row_data.source_title,
    row_data.source_description, row_data.sort_order
  from jsonb_populate_recordset(null::public.product_color_options, p_color_options) as row_data
  on conflict (product_id, color_id) do update set
    feed_item_id = excluded.feed_item_id,
    available = excluded.available,
    price_mad = excluded.price_mad,
    source_title = excluded.source_title,
    source_description = excluded.source_description,
    sort_order = excluded.sort_order;
  get diagnostics option_count = row_count;

  insert into public.product_images (
    id, product_id, color_option_id, image_url, sort_order
  )
  select
    row_data.id, row_data.product_id, row_data.color_option_id,
    row_data.image_url, row_data.sort_order
  from jsonb_populate_recordset(null::public.product_images, p_product_images) as row_data
  on conflict (id) do update set
    product_id = excluded.product_id,
    color_option_id = excluded.color_option_id,
    image_url = excluded.image_url,
    sort_order = excluded.sort_order;
  get diagnostics image_count = row_count;

  select duplicate_ids.feed_item_id
  into duplicate_feed_item_id
  from (
    select feed_item_id
    from (
      select feed_item_id from public.products where feed_item_id is not null
      union all
      select feed_item_id from public.product_color_options where feed_item_id is not null
    ) as all_feed_ids
    group by feed_item_id
    having count(*) > 1
    limit 1
  ) as duplicate_ids;
  if duplicate_feed_item_id is not null then
    raise exception 'Duplicate feed_item_id across products and color options: %', duplicate_feed_item_id;
  end if;

  return jsonb_build_object(
    'products', product_count,
    'color_options', option_count,
    'product_images', image_count
  );
end;
$$;

revoke all on function public.save_reviewed_catalogue(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_reviewed_catalogue(jsonb, jsonb, jsonb) to authenticated;

commit;
