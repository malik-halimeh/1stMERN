---
name: verify
description: How to build, run, and drive this MERN app (OptiCart) for verification.
---

# Verifying changes in this repo

## Build (type-check)
- `cd server && npm run build` (tsc)
- `cd client && npm run build` (tsc -b && vite build)

## Run
- Backend: `cd server && npm run dev` (tsx watch, port 5000, needs local MongoDB via `server/.env` MONGO_URI). Ready when `GET http://localhost:5000/api/ping` returns `{"pong":true}` (~5s).
- Frontend: `cd client && npm run dev` (Vite; API base = `VITE_API_URL` or `http://localhost:5000/api`).

## Drive the API
Seeded users (see `server/seed.ts`; run `cd server && npm run seed` if missing):
- `admin@opticart.dev` / `Admin123!` (super_admin)
- `manager@opticart.dev` / `Manager123!` (inventory_manager)
- `customer@opticart.dev` / `Customer123!` (customer)

Login: `POST /api/auth/login {email,password}` → `data.accessToken`, then `Authorization: Bearer <token>`.

## Gotchas
- All money is integer cents (`...Cents`). Stock lives per-variant (`variants[].sku`).
- `PATCH /api/products/:id` accepts plain JSON when not uploading files, but `variants` REPLACES the whole array — snapshot the current variants first and send them back verbatim, or you'll clobber colors/deltas/images.
- Analytics routes (`/api/analytics/*`) are super_admin-only; staff list endpoints paginate with `{data, meta:{total,page,limit,pages}}`.
- Low-stock alerts auto-fire when stock ≤ threshold; resolve with `PATCH /api/low-stock/:id/resolve`.
- Restore any test data you mutate — this is the user's seeded dev DB.
