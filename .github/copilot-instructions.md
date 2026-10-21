# Repository Guide

## Project shape

This is a mobile-first Morocco storefront for baby and children's essentials. Read [docs/PROJECT_OVERVIEW.md](../docs/PROJECT_OVERVIEW.md) for scope, [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for the Next.js/Supabase design, and [docs/DESIGnPATTERNS.md](../docs/DESIGnPATTERNS.md) for implementation constraints.

The app includes Arabic, French, English, and Spanish storefronts; a Supabase catalogue and owner-only product dashboard; a browser-persisted identifier-only cart; and COD order requests through a customer-initiated WhatsApp handoff. Opening WhatsApp is not order confirmation or inventory reservation. Online payments, customer accounts, stored order records, and B2B features are out of scope.

## Build and test

Use `pnpm install --ignore-scripts`, `pnpm dev`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Runtime setup, Supabase migration, owner provisioning, and environment variables are documented in the root README.

## Project-specific conventions

- Keep Supabase as the source of truth for product identity, localized content, current prices, availability, and variants. Cart storage contains only product IDs, option IDs, and positive integer quantities; derive displayed names and totals from the current catalogue.
- Keep money calculations in MAD using whole-dirham integers.
- Do not invent delivery rates or coverage. If a rate is not confirmed, request a quote and state that the total is not final.
- Validate cart selections and checkout fields before composing a WhatsApp request. Encode the message; do not claim the order is confirmed or clear the cart merely because WhatsApp opened.
- Keep customer contact/address details transient; do not persist them in browser storage.
- Support Arabic RTL and French/English/Spanish LTR. Keep UI text translated and handle direction explicitly.
- Enforce owner write access in Supabase RLS and Storage policies as well as the dashboard UI. Never expose a service-role key.
- Prefer explicit unavailable-product, invalid-checkout, unknown-delivery, empty-cart, and database-error states.
