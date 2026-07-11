# OptiCart — Appliances MERN Platform

Full-stack appliance e-commerce platform built with MongoDB, Express, React, and Node.js (MERN).

---

## 🚀 Quick Start

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Start backend (dev)
cd server && npm run dev

# Start frontend (dev)
cd client && npm run dev
```

App runs on:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api

---

## 🌱 Database Seed

Populates the database with realistic test data. **Drops and re-creates all data** — development only.

```bash
cd server && npm run seed
```

### Seed Summary
| Collection | Count |
|---|---|
| Users | 3 (one per role) |
| Categories | 4 (2 parent + 2 child) |
| Products | 12 (2–3 variants each) |
| Orders | 5 (all statuses) |
| Reviews | 8 (verified-purchase only) |
| Coupons | 2 active |
| Low-stock alerts | 1 active |

---

## 🔐 Test Credentials

| Role | Email | Password |
|---|---|---|
| **Customer** | `customer@opticart.dev` | `Customer123!` |
| **Inventory Manager** | `manager@opticart.dev` | `Manager123!` |
| **Super Admin** | `admin@opticart.dev` | `Admin123!` |

---

## 🎟 Test Coupons

| Code | Type | Value | Min Order | Expiry |
|---|---|---|---|---|
| `SAVE10` | Percentage | 10% off | $50 | +90 days |
| `FLAT50` | Fixed | $50 off | $500 | +30 days |

---

## 💳 Stripe Test Mode

The app runs in Stripe mock mode by default (`STRIPE_SECRET_KEY=sk_test_mock_key`).

To use real Stripe test mode:
1. Set `STRIPE_SECRET_KEY=sk_test_...` in `server/.env`
2. Set `STRIPE_WEBHOOK_SECRET=whsec_...` for local webhook testing
3. Use Stripe test card: **4242 4242 4242 4242**, any future expiry, any CVC

---

## 🏗 Architecture

### Backend (`server/`)
- **Express** + TypeScript
- **Mongoose** (MongoDB ODM) with full index strategy
- **JWT** (access + refresh tokens via httpOnly cookies)
- **Stripe** payment intents + webhook handler
- **node-cron** daily recommendation engine
- **Role-based auth**: `customer` / `inventory_manager` / `super_admin`

### Frontend (`client/`)
- **React** + TypeScript + Vite
- **React Router v7** (client-side navigation)
- **Context API** (AuthContext, ShopContext, ToastContext)
- **Guest support**: localStorage cart + wishlist with merge-on-login

---

## 📡 API Overview

| Route Prefix | Visibility | Auth |
|---|---|---|
| `GET /api/products` | Public | None |
| `GET /api/categories` | Public | None |
| `GET /api/product-recommendations` | Public | None |
| `POST /api/product-events/batch` | Public | None |
| `POST /api/auth/register` | Public | None |
| `POST /api/auth/login` | Public | None |
| `GET /api/cart` | Customer | Bearer token |
| `GET /api/wishlist` | Customer | Bearer token |
| `POST /api/orders/checkout-session` | Customer | Bearer token |
| `POST /api/orders/webhook` | Stripe | Webhook sig |
| `GET /api/coupons` | Manager | Bearer token |
| `PATCH /api/orders/:id/status` | Manager | Bearer token |
| `GET /api/low-stock` | Manager | Bearer token |
| `GET /api/audit-logs` | Super Admin | Bearer token |

---

## 🕐 Scheduled Jobs

The recommendation engine runs **daily at 02:00** via node-cron:
1. **Co-occurrence computation** — aggregates `productEvents` (purchase), builds product-pair weights with recency decay `1/(daysSince+1)`, writes top-10 recommendations per product to `productRecommendations`.
2. **Trending/MostSelling flag update** — aggregates 7-day order volume and view velocity, updates `isTrending` / `isMostSelling` flags on products.

Recommendations are **never** computed synchronously on page load — only the cached `productRecommendations` collection is read.

---

## ✉️ Email Notifications

Real emails are sent when SMTP credentials exist in `server/.env` (`GMAIL_USER` + `GMAIL_APP_PASSWORD`, or generic `SMTP_*` variables). Without credentials every message logs to the server console instead. Triggers:
- **Signup verification code** — 6-digit code, required before the first login
- **Password reset code** — 6-digit code for the forgot-password flow
- **Order confirmation** — fires when the Stripe webhook confirms payment
- **Order status change** — fires on confirmed/shipped/delivered/cancelled/refunded transitions (includes the staff-entered reason for cancellations and refunds)
- **Low-stock alert** — sent to all active inventory managers when a variant's stock drops to its threshold (one email per unique active alert)

Transport selection lives in `server/src/services/mailer.ts`.

---

## 🗂 Environment Variables

Copy `server/.env.example` to `server/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/opticart
JWT_ACCESS_SECRET=<long random string — REQUIRED in production>
CLIENT_URL=http://localhost:5173
STRIPE_SECRET_KEY=sk_test_mock_key      # real key enables live Stripe test mode
STRIPE_WEBHOOK_SECRET=                  # whsec_... — required with a real Stripe key
CLOUDINARY_URL=cloudinary://mock        # real URL enables uploads
GOOGLE_CLIENT_ID=                       # enables Google sign-in
GMAIL_USER=                             # + GMAIL_APP_PASSWORD enables real emails
GMAIL_APP_PASSWORD=
NODE_ENV=development
```

Notes: only `JWT_ACCESS_SECRET` is read for token signing (the refresh token is an opaque random string, not a JWT). In production the server **refuses to start** without `JWT_ACCESS_SECRET`.
