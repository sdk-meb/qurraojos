# QurraOjos Store V1

Mobile-first storefront for QurraOjos قرة عيني in Morocco: Arabic-first product catalogue, four interface languages, COD requests through WhatsApp, and a private Supabase-backed product dashboard.

## Requirements

- Node.js 22.x (pinned for consistent local and Vercel builds)
- pnpm
- A Supabase project for persistent products, owner authentication, and product-image uploads

## Run locally

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Without Supabase, local development uses a visibly labeled demo catalogue. It contains sample names/prices and placeholder illustrations, not real or launch-ready products. The production app does not use the demo catalogue.

## Configure Supabase

1. Create a Supabase project and copy its project URL and public anon key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Set all `NEXT_PUBLIC_*` variables before building because Next.js bundles them into the browser app.
2. Apply [the catalogue migration](./supabase/migrations/202610210001_catalogue.sql), then [the product feed schema migration](./supabase/migrations/202610230001_product_feed_fields.sql) in the Supabase SQL editor. These SQL files create/update the schema only; they do not insert catalogue products.
3. Create the store owner's account in Supabase Auth. Disable public sign-up.
4. In the Supabase SQL editor, mark only the intended owner as a store manager. Replace the placeholder email before running:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
     || '{"store_owner": true}'::jsonb
   where email = 'OWNER_EMAIL';
   ```

   Verify exactly one intended user was updated. `app_metadata` is server-managed; do not grant the browser a service-role key. RLS and Storage policies independently enforce this owner claim.
5. Add products in `/admin` individually or upload the product CSV directly. The importer validates required columns when present, uses the selected category when no store category is supplied, accepts multiple image URLs, and reports skipped rows. Only whole MAD prices from 10 to 300 are accepted. CSV rows are written by the owner dashboard, not by the SQL migrations.
6. To browse public Google Drive image folders from the product form, enable the Google Drive API and set `GOOGLE_DRIVE_API_KEY` as a server-only environment variable. Restrict the key to the Drive API and keep it out of `NEXT_PUBLIC_*` variables. Share the image folder for public link access; Drive is contacted only when the signed-in owner clicks **Browse folder** in `/admin`. The folder and its direct subfolders are shown as a tree, and selecting one adds image links from that folder and one subfolder level to the form. The product is written to Supabase only when **Save product** is clicked.
7. Verify the store's direct WhatsApp number, then set `NEXT_PUBLIC_WHATSAPP_NUMBER` to its international digits only (for example `212...`, without `+` or spaces). The app deliberately does not guess the recipient.
8. Configure `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin. Confirm the actual delivery service areas and prices before publishing them. Until configured, checkout asks the store to confirm delivery and does not show a fabricated total.
9. Once rates are verified, optionally set `NEXT_PUBLIC_DELIVERY_FEES` to a JSON object mapping accepted city names to integer MAD charges, for example `{"casablanca":25,"rabat":30}`. The sample is illustrative only—replace it with actual carrier/store rates. Unknown cities remain quote-only. This public configuration is bundled into the storefront; do not put secrets in it.
10. Replace sample content with accurate products, stock, prices, images, safety information, and approved return/privacy policies before accepting real customers.

## Commands

```sh
pnpm dev        # Local development
pnpm typecheck  # TypeScript check
pnpm lint       # ESLint
pnpm build      # Production build
pnpm start      # Serve a production build
```

Customer contact and address details are not stored by this app. The browser keeps only cart product/variant IDs and quantities. Opening WhatsApp is only a handoff; the customer must send the message, and the store manually confirms stock and final delivery details.

## Project documentation

- [MVP scope and release checks](./docs/PROJECT_OVERVIEW.md)
- [Architecture and access model](./docs/ARCHITECTURE.md)
- [Implementation patterns](./docs/DESIGnPATTERNS.md)
