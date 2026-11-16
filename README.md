# Halaq — barber booking marketplace + barbershop OS

Arabic/English (RTL) web app. Customers book barbershop appointments without an account; shop owners manage bookings, barbers, services, hours and a printable QR from a dashboard.

Non-technical setup guide (Arabic): **`دليل-التشغيل.md`**.

## Stack
- **Frontend:** React 18 + Vite 5 + Tailwind 3 (plain JSX), `react-router-dom` 6, `@supabase/supabase-js` 2, `qrcode`. Hosted as a static SPA (Cloudflare Pages; `web/public/_redirects` handles SPA routes).
- **Backend:** Supabase only (Postgres + Auth + Storage + Realtime). No custom server.

## Run locally
```bash
cd web
cp .env.example .env   # fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_SITE_URL
npm install
npm run dev
```
Apply `supabase/migrations/*.sql` in order (SQL editor or `supabase db push`). Both files are idempotent.

## Data model (`0001_schema.sql`)
| table | notes |
|---|---|
| `profiles` | 1:1 with `auth.users`, filled by trigger from signup metadata |
| `shops` | tenant. `slug` = public URL, `timezone` (default Africa/Cairo), booking rules, `plan`/`trial_ends_at` |
| `shop_members` | user ↔ shop with role `owner/manager/barber`; drives all RLS via `is_shop_staff()` / `is_shop_admin()` |
| `barbers`, `services` | per shop; public read when shop active |
| `working_hours` | one row per open weekday; `closes <= opens` ⇒ closes after midnight |
| `time_off` | per barber or whole shop (`barber_id` null) |
| `bookings` | `EXCLUDE USING gist (barber_id =, tstzrange(starts_at, ends_at) &&)` for active statuses → double booking impossible even under concurrency. `manage_token` = private guest link |
| `booking_items` | price/name snapshot of each service |
| `reviews` | one per completed booking |
| `shops_directory` | `security_invoker` view with rating/min price |

### Write paths (all `SECURITY DEFINER` RPCs)
- `create_shop(name, slug, area, phone)` → shop + owner membership + default hours
- `get_available_slots(shop, date, duration, barber?)` → free start times (respects hours, time off, notice, horizon, existing bookings)
- `create_booking(...)` → validates services/slot server-side, computes price/duration, picks least-busy barber for "any"; `p_source` `walk_in`/`phone` requires staff
- `get_booking_by_token`, `cancel_booking_by_token` (respects `cancel_cutoff_min`), `submit_review`, `is_slug_available`

Staff update booking status directly (RLS); a trigger blocks changes to `shop_id/code/manage_token/customer_id`. Errors are raised as codes (`SLOT_TAKEN`, …) and mapped to i18n in `web/src/lib/format.js`.

## Frontend map
- `src/lib/dict.js` — every UI string (ar/en). `src/lib/i18n.jsx` sets `dir`.
- `src/lib/time.js` — all date math in the **shop's** timezone (independent of device tz).
- `src/pages/` — Home, ShopPage (+ `components/BookingWizard`), ManageBooking (`/b/:token`), MyBookings (account + guest tokens in localStorage), Auth, Onboarding (`/start`), Partners (pitch + ROI calculator), `dashboard/*`.

## Verified
- Migration run twice on Postgres 16 with Supabase-like `auth`/`storage` stubs.
- RLS: other owners can't read/modify a shop's data; anon can't read bookings/profiles/time_off or call `create_shop`; storage uploads limited to the shop's folder.
- 8 concurrent `create_booking` calls for the same barber/slot → exactly 1 succeeds.
- Playwright E2E through PostgREST: owner signup → shop creation → add barber → guest mobile booking → owner sees it, completes it, adds walk-in → guest review appears on shop page; Arabic and English.

## Next steps
WhatsApp Cloud API reminders (Edge Function + `pg_cron`), barber invites (role exists), platform admin for plans, online deposits (Paymob/Fawry).
