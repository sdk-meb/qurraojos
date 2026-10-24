# Implementation and design patterns

These patterns describe the current QurraOjos MVP. Keep the implementation lightweight and avoid features that turn a WhatsApp request into a false promise of a confirmed order.

## Product and variant model

Use a stable product ID and unique URL slug. Store localized product/category copy, an integer MAD price, explicit availability, optional image URLs, feed metadata, and a list of explicit variants. Each purchasable size/color combination must be represented as its own option; never infer a cross-product matrix. Validate IDs, slug, non-negative integer price, image URLs, and variant JSON at the database/form boundary. The owner CSV uploader parses product rows directly; SQL migrations update schema only.

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

Allow a small, image-only upload with the bucket's file size and MIME type limits. Product image URLs are public read-only; uploads and mutations are owner-only. Image links must return image content directly; normalize Google Drive sharing links to its `lh3.googleusercontent.com/d/{fileId}=w1600` image URL and require the file to be accessible to anyone with the link. Never accept executable or arbitrary files as product media.

The owner-only admin form may browse a public Google Drive folder on explicit click. Keep its API key server-only, validate the owner session on the route, and do not fetch folder contents while rendering the admin page. Selecting a folder adds image links from that folder and its immediate child folders to the unsaved form; only the normal product-save action writes those links to Supabase.

## Localization and accessibility

Keep interface copy translated for Arabic, French, English, and Spanish. Set Arabic RTL and other locales LTR at the route/container boundary. Use semantic headings, visible focus indicators, associated form labels, native input validation, meaningful product alt text, and a reduced-motion fallback.

## Failures

Do not show a success state for a failed Supabase operation or an unconfigured WhatsApp destination. Explain empty catalogue, invalid/out-of-stock cart entries, unconfirmed delivery rates, and database/network errors. Keep the cart intact on failed or incomplete handoff.
