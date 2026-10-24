# QurraOjos Store V1 — Architecture

## Status

This document describes the implemented application and its external setup. The application is a storefront and COD order-request tool, not a payment processor or order-management backend.

## Stack

- Next.js 14 App Router and React 18, in TypeScript.
- pnpm for dependency management and scripts.
- Supabase Postgres for categories/products, Supabase Auth for the provisioned store owner, and Supabase Storage for product images.
- Public catalogue access uses the Supabase anon key plus RLS. Never place a service-role key in the app.

## Public route and data flow

```text
Customer browser
    |
    +--> /ar, /fr, /en, /es (localized, responsive storefront)
    |          |
    |          +--> Supabase public catalogue reads
    |          +--> localStorage cart (IDs, option IDs, quantities only)
    |          +--> transient checkout form
    |                    |
    |                    +--> encoded wa.me request, customer chooses to send
    |
    +--> /admin (owner sign-in and product/image management)
               |
               +--> Supabase Auth session + owner RLS/storage policies
               +--> on-demand, owner-checked Google Drive folder listing
               +--> validated CSV product upserts
```

Storefront routes are client-navigated with Next.js while retaining localized URLs for home, catalog, product details, and cart; `/admin` remains separate. Catalog search and category filters update the URL without a full document reload. Public catalogue routes are request-rendered so catalogue updates are reflected without rebuilding the app. `NEXT_PUBLIC_*` environment variables must be set in the deployment build environment because Next.js bundles public values into the browser app. If Supabase is not configured in local development, clearly labeled demo products make the UI testable. Production does not fall back to demo data.

The admin Drive folder browser does not query Google during page rendering. An owner click sends the folder link to `/api/admin/drive-folders`; the route validates the Supabase access token and `store_owner` claim before calling the Drive API with the server-only `GOOGLE_DRIVE_API_KEY`. It lists images in the selected folder and one direct subfolder level. The selected public image links remain in the product form until the owner saves the product to Supabase.

## Database and authorization

Apply `supabase/migrations/202610210001_catalogue.sql`, then `supabase/migrations/202610230001_product_feed_fields.sql` in a Supabase project. The first creates localized category/product tables, public read policies, owner-write policies, the product image bucket, and image access policies. The second adds CSV/feed metadata columns only; it does not insert product rows. Categories are initialized by the first migration. Product names/descriptions and variant labels use localized JSON values for `ar`, `fr`, `en`, and `es`.

The owner dashboard accepts product CSVs with `title` or `name` and a MAD `price`; when fields such as `description`, `availability`, `condition`, `brand`, `link`, `image_link`, or `id` appear in the feed header, non-empty values are required. Optional Meta feed columns are retained in `feed_attributes`, and `image_link` plus semicolon-separated `additional_image_link` values are saved as multiple images. Google Drive sharing URLs are converted to the public `lh3.googleusercontent.com/d/{fileId}=w1600` image endpoint for rendering; the file must be publicly accessible. Prefer uploading images to Supabase Storage when possible. Prices must be whole MAD amounts from 10 to 300; a non-empty `sale_price` is imported as the current price. Category values must be existing category IDs; otherwise the selected default category is used. CSV uploads upsert on slug and preserve existing translations, variants, images, and optional values not included in a later upload. Product rows are loaded directly from the CSV in `/admin`; SQL migrations only change the schema.

Create/provision the owner through Supabase Auth, then set the server-managed `store_owner: true` claim in that user's `app_metadata`. The dashboard checks the claim to present write controls; Postgres RLS and Storage policies independently enforce it. Disable public sign-up in Supabase. Do not give the anon key owner privileges.

## Cart and COD handoff

- Store only a versioned list of product/variant identifiers and bounded positive integer quantities in browser storage.
- Read current names, prices, and availability from the catalogue. Do not trust storage as a price or inventory authority.
- Do not persist checkout name, phone, or address.
- The checkout contains a delivery charge only when the business has configured a verified city-to-fee mapping in `NEXT_PUBLIC_DELIVERY_FEES`. Currently no delivery prices are supplied, so every area must be confirmed manually and the total remains explicitly unconfirmed.
- Validate available items and required contact fields, then URL-encode the WhatsApp message. Opening WhatsApp does not imply submission or confirmation; keep the cart.

The direct WhatsApp phone number must be verified and set with `NEXT_PUBLIC_WHATSAPP_NUMBER`. If it is absent, the site reports that WhatsApp ordering is not configured rather than opening an unknown destination.

## Localization, accessibility, and SEO

Locale routes set the language and direction on the storefront container. Arabic uses RTL and French, English, and Spanish use LTR. Forms have visible labels and native validation; keyboard focus and reduced-motion preferences are supported. Product metadata is derived from the current catalogue where available. Configure `NEXT_PUBLIC_SITE_URL` for canonical metadata.

## Operational setup

See the root [README](../README.md) for pnpm commands, environment variables, migration steps, and owner provisioning. Before launch, the operator supplies real product information/images, verifies WhatsApp, confirms delivery charges and coverage, and reviews store policies.

## Deliberately omitted

There are no customer accounts, card/payment APIs, server-side order records, stock reservations, carrier integrations, customer PII database, or role/tenant system. Add such capabilities only when validated needs justify the additional operational and privacy burden.
