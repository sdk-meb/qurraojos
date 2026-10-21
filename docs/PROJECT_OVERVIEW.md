# QurraOjos Store V1 — MVP

## Purpose

QurraOjos قرة عيني is a mobile-first Moroccan B2C storefront for baby and children's products. V1 supports browsing, product options, a device-persisted cart, cash-on-delivery (COD) order requests through WhatsApp, and a small authenticated product-management dashboard.

The customer-facing default is Arabic. French, English, and Spanish are also available, with direction set per language. Prices are in Moroccan dirhams (MAD / DH).

## V1 scope

- Four catalogue categories: Birth Gifts (هدايا العقيقة), Child Rearing (تربية الأطفال), Children's Clothing (ملابس الأطفال), and Baby Supplies (مستلزمات الرضع).
- A target of 12 operator-supplied launch products, with 1–8 explicitly modeled variants per product where needed; product variants are selected explicitly, not inferred from size/color combinations.
- Catalogue price range: 10–300 DH. Target gross margins are 15–25% below 50 DH, 20–30% from 50–200 DH, and 15–30% above 200 DH; margins are business targets, not app-enforced pricing rules.
- Browse and search products, view details, choose an available variant, and add/remove items from a cart that survives refreshes on the same device.
- COD only. Checkout gathers the name, phone number, city, and delivery address temporarily, then opens an encoded WhatsApp order request for the customer to review and send.
- Product inventory, prices, localized names/descriptions, variants, and photos are maintained through a single-owner dashboard backed by Supabase.
- Delivery rates are intentionally not guessed. Optional `NEXT_PUBLIC_DELIVERY_FEES` can map verified city names to MAD charges; until configured, the checkout identifies delivery and total as subject to confirmation.

## Customer order status and privacy

Opening WhatsApp is not proof the customer sent a message, the store received the request, stock is reserved, or an order is confirmed. The store confirms availability and final delivery charges with the customer.

The website does not persist customer names, phones, or addresses. Cart storage contains only product IDs, variant IDs, and positive quantities. Checkout details are included in the WhatsApp message only after the customer chooses to open it.

## Setup requirements

The app uses Next.js 14 and pnpm. Supabase provides product storage, owner authentication, and image storage. Configure the environment variables shown in `.env.example`, apply the SQL migration in `supabase/migrations/`, provision an owner account, and add real catalogue content before public launch. Setup details are in [README.md](../README.md).

When Supabase is not configured locally, a clearly labeled demo catalogue is available for development. Demo products and prices are not real stock or launch content. A production build without Supabase does not publish those samples.

The store's WhatsApp destination must be verified and configured before enabling the order handoff. The operator must also confirm delivery coverage/charges, product photos and copy, and return/exchange and privacy wording.

## Out of scope

- Online card payment, bank-transfer checkout, accounts for customers, customer order records, automatic inventory reservation, and carrier integration.
- Multi-user roles, a public admin sign-up flow, loyalty/reviews/discount features, and B2B workflows.

Revisit these after market validation and when fulfillment or manual catalogue updates become a measurable operational bottleneck.

## Success checks

- Arabic-first storefront is usable on a phone and supports all four selectable languages with correct RTL/LTR.
- Customer can browse a category, inspect a product, choose a variant, add it to a persistent cart, and create a WhatsApp COD request with a correct item summary.
- Unknown delivery pricing is never fabricated; request copy distinguishes a handoff from a confirmed order.
- Owner-only changes are enforced by database and storage policies, not just by hiding admin UI.
- Product photos, actual data, published policies, delivery arrangements, and WhatsApp contact are verified before launch.
- After launch, review product views, cart additions, WhatsApp requests, confirmed orders, cancellation reasons, and delivery issues without collecting unnecessary customer data.
- The expected 20–50 daily visitors and 1–3% conversion are validation hypotheses, not guaranteed outcomes.
