# Implementation and design patterns

These patterns describe the current QurraOjos MVP. Keep the implementation lightweight and avoid features that turn a WhatsApp request into a false promise of a confirmed order.

## Product and color model

Use a stable product ID and unique URL slug. Store localized product/category copy, an integer MAD price, explicit availability, feed metadata, and color options that reference the fixed `colors` registry. The admin does not create arbitrary color names or size variants. Keep image URLs only in `product_images`, one globally unique URL per row; null `color_option_id` denotes a product-wide image and a populated ID denotes a color-specific image. Validate slugs, color registry references, image URLs, and whole-dirham prices at the database/form boundary. The Meta + Drive import wizard stages records locally and requires an explicit per-product trust action before saving; SQL scripts update schema/reference data only.

The browser cart references catalogue IDs only. Product names, availability, and prices are re-read from the current catalogue. Invalid, missing, and out-of-stock entries are surfaced and must be removed or corrected before a request can be created.

## Cart and COD request

- Persist only product ID, option ID, and a positive bounded quantity in versioned local storage.
- Do not store checkout name, phone, address, product prices, or names in browser storage.
- Derive the subtotal using integer whole-dirham amounts; do not use floating point for money.
- Do not invent a delivery fee or imply nationwide delivery. If coverage or charge is unknown, say it needs confirmation and do not present a final total.
- Use an encoded click-to-chat URL with a verified configured phone number. The message is an order request; the store manually confirms stock and the final total.
- Keep the cart after opening WhatsApp. The browser cannot verify that the customer sent the message.

## Admin and images

Do not provide public admin registration. Provision the owner in Supabase Auth and assign the `store_owner` boolean in server-managed `app_metadata`. Database write policies and Storage write policies independently check this claim. Do not use the Supabase service-role key in browser or server-rendered app bundles.

Allow a small, image-only upload with the bucket's file size and MIME type limits. Product image URLs are public read-only; uploads and mutations are owner-only. Keep all general and color-specific images in `product_images`; localized color names, availability, and optional price live in `product_color_options`, which references the fixed `colors` registry. Do not duplicate image URLs on products/options or encode attributes into URL strings. Image links must return image content directly; normalize Google Drive sharing links to its `lh3.googleusercontent.com/d/{fileId}=w1600` image URL and require the file to be accessible to anyone with the link. Never accept executable or arbitrary files as product media.

The owner-only admin form may browse a public Google Drive folder on explicit click. Keep its API key server-only, validate the owner session on the route, and do not fetch folder contents while rendering the admin page. Load one folder level per navigation click so folder browsing can continue at any depth without eager recursive fetches. The product image manager targets a selected fixed color image set or the product-wide fallback set. Only the normal product-save action writes those edits to Supabase. Removing a link does not delete the source file. Drive file/folder mutations are out of scope unless a separately authorized Google OAuth integration is added.

## Localization and accessibility

Keep interface copy translated for Arabic, French, English, and Spanish. Set Arabic RTL and other locales LTR at the route/container boundary. Use semantic headings, visible focus indicators, associated form labels, native input validation, meaningful product alt text, and a reduced-motion fallback.

## Failures

Do not show a success state for a failed Supabase operation or an unconfigured WhatsApp destination. Explain empty catalogue, invalid/out-of-stock cart entries, unconfirmed delivery rates, and database/network errors. Keep the cart intact on failed or incomplete handoff.
