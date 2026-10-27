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
               +--> owner-authenticated server-side CSV interpretation and product/color upserts
```

Storefront routes are client-navigated with Next.js while retaining localized URLs for home, catalog, product details, and cart; `/admin` remains separate. Catalog search and category filters update the URL without a full document reload. Public catalogue routes are request-rendered so catalogue updates are reflected without rebuilding the app. `NEXT_PUBLIC_*` environment variables must be set in the deployment build environment because Next.js bundles public values into the browser app. If Supabase is not configured in local development, clearly labeled demo products make the UI testable. Production does not fall back to demo data.

The admin Drive folder browser does not query Google during page rendering. An owner click sends the folder link to `/api/admin/drive-folders`; the route validates the Supabase access token and `store_owner` claim before calling the Drive API with the server-only `GOOGLE_DRIVE_API_KEY`. It lists the selected folder's images and immediate subfolders; opening a subfolder fetches only that folder and its immediate children, allowing lazy navigation at any depth. The product image manager previews Drive images and lets the owner add/remove/reorder product image links, upload images, or add public image URLs. Those edits remain in the product form until saved and do not modify the source Drive or Storage files. Drive browsing is read-only; file/folder mutations require a separate Google OAuth integration.

## Database and authorization

For a fresh project, apply `supabase/fresh_catalogue_schema.sql`. To upgrade an existing project created with the earlier catalogue schema, apply `supabase/migrations/202610260001_import_catalogue_schema.sql` instead. Then apply `supabase/store_categories.sql`. The schema scripts create localized category/product tables, normalized product color options, public read policies, owner-write policies, the product image bucket, and image access policies; the category script upserts the six storefront categories. Product rows are loaded separately. Do not combine the fresh schema with legacy migrations, whose category IDs no longer match the storefront. Product names/descriptions and variant labels use localized JSON values for `ar`, `fr`, `en`, and `es`.

The owner dashboard sends CSV files to an owner-authenticated server route for parsing and writes; the browser does not interpret or directly upsert feed rows. It accepts `title` or `name` and a MAD `price`. Recognized Google/Facebook product taxonomies map to the six store category IDs; an explicit `category`, `category_id`, or `store_category` value may also supply a category. The selected category must exist in the database; unknown or unmapped categories are reported rather than assigned a default. Rows whose titles match after removing the final CSV color value are grouped as one product; their colors are stored both as app-compatible variants and in `product_color_options`, with their own feed IDs and image URLs. Indexed `additional_image_link[n]` columns are parsed along with `image_link`. Optional feed columns are retained in `feed_attributes` and supported schema fields. Prices must be whole MAD amounts from 10 to 300; a non-empty `sale_price` is imported as the current price. Google Drive sharing URLs are converted to the public `lh3.googleusercontent.com/d/{fileId}=w1600` image endpoint for rendering; the file must be publicly accessible. Prefer uploading images to Supabase Storage when possible. Product upserts preserve translations and optional values not included in later imports.

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
