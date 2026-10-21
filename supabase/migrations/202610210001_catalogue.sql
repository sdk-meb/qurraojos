create extension if not exists pgcrypto;

create table if not exists public.categories (
  id text primary key,
  name jsonb not null check (
    jsonb_typeof(name) = 'object'
    and length(trim(coalesce(name ->> 'ar', ''))) > 0
  ),
  description jsonb not null check (jsonb_typeof(description) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category_id text not null references public.categories(id) on update cascade,
  name jsonb not null check (
    jsonb_typeof(name) = 'object'
    and length(trim(coalesce(name ->> 'ar', ''))) > 0
  ),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  price_mad integer not null check (price_mad between 10 and 300),
  available boolean not null default true,
  image_url text,
  variants jsonb not null default '[]'::jsonb check (
    case
      when jsonb_typeof(variants) = 'array' then jsonb_array_length(variants) <= 8
      else false
    end
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

insert into public.categories (id, name, description) values
  ('birth-gifts',
    '{"ar":"هدايا العقيقة","fr":"Cadeaux de naissance","en":"Birth gifts","es":"Regalos de nacimiento"}',
    '{"ar":"هدايا وقطع مختارة لاستقبال المولود الجديد.","fr":"Des cadeaux choisis pour accueillir bébé.","en":"Thoughtful gifts to welcome a new baby.","es":"Regalos para dar la bienvenida al bebé."}'),
  ('child-rearing',
    '{"ar":"تربية الأطفال","fr":"Éducation","en":"Child rearing","es":"Crianza"}',
    '{"ar":"ألعاب وأدوات تساعد على التعلم والنمو.","fr":"Jeux et accessoires pour apprendre.","en":"Toys and tools for learning and growth.","es":"Juegos y herramientas para aprender."}'),
  ('children-clothing',
    '{"ar":"ملابس الأطفال","fr":"Vêtements enfants","en":"Children''s clothing","es":"Ropa infantil"}',
    '{"ar":"ملابس ناعمة ومريحة للأشهر الأولى.","fr":"Des vêtements doux pour les premiers mois.","en":"Soft, comfortable clothes for little ones.","es":"Ropa suave y cómoda para los pequeños."}'),
  ('baby-supplies',
    '{"ar":"مستلزمات الرضع","fr":"Bébé et puériculture","en":"Baby supplies","es":"Bebé y puericultura"}',
    '{"ar":"احتياجات يومية للعناية والراحة.","fr":"Les essentiels du quotidien et du bien-être.","en":"Everyday essentials for baby care.","es":"Artículos esenciales para el cuidado diario."}')
on conflict (id) do nothing;

create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_available_idx on public.products(available);

alter table public.categories enable row level security;
alter table public.products enable row level security;

grant select on public.categories, public.products to anon, authenticated;
grant insert, update, delete on public.categories, public.products to authenticated;

create policy "Categories are visible to everyone"
  on public.categories for select using (true);
create policy "Products are visible to everyone"
  on public.products for select using (true);
create policy "Store owner manages categories"
  on public.categories for all
  using ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true')
  with check ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true');
create policy "Store owner manages products"
  on public.products for all
  using ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true')
  with check ((auth.jwt() -> 'app_metadata' ->> 'store_owner') = 'true');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

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
