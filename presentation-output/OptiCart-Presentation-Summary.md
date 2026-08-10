# OptiCart Presentation Summary

## Narrative strategy

The six-slide story positions OptiCart as one connected commerce operation: it begins with the customer/business gap, proves the customer buying journey, shows the operational workflow behind it, then closes with management visibility and the team’s product-delivery capability.

## Primary business-value dimensions

1. **Customer journey continuity:** discovery, comparison, saved cart/wishlist state, coupons, checkout, order history, notifications, and feedback form one coherent experience.
2. **Operational control and visibility:** catalog and variant management, fulfillment statuses, stock alerts, procurement tracking, analytics, role-specific access, and audit logs support daily business work.

The showcased features were selected because they connect demand to fulfillment and decision-making, rather than presenting a disconnected feature list.

## Presenter distribution and timing

- Malik: slides 1–2, 137 words, approximately 64.2 seconds.
- Mahmod: slides 3–4, 145 words, approximately 68.0 seconds.
- Haya: slides 5–6, 150 words, approximately 70.3 seconds.

- Total: 432 spoken words.
- Speaking estimate: 202.5 seconds at 128 words per minute.
- Transition/handoff allowance: 12 seconds.
- Estimated presentation runtime: **3:35**, below the four-minute maximum.

## Important assumptions

- No adoption, customer, revenue, performance, or cost-saving claims are made.
- Figures visible in management screenshots are representative local test data and are explicitly labeled as such in the deck.
- Potential business uses are described as possibilities, separate from implemented functionality.

## Screenshot sources

- `ui-storefront.png`: actual OptiCart React storefront rendered locally.
- `ui-admin-dashboard.png`: actual OptiCart React admin dashboard rendered locally.
- `ui-analytics.png`: actual OptiCart React analytics view rendered locally.

The UI was rendered against an isolated local fixture service solely for presentation capture. No database, seed, migration, account, environment configuration, or external service was modified. Screenshot hashes were matched programmatically to media embedded in the PowerPoint.

## Repository evidence reviewed

- Routing and role guards: `client/src/App.tsx`, `server/src/middleware/auth.ts`
- Customer journey: `client/src/pages/Home.tsx`, `ProductList.tsx`, `ProductDetail.tsx`, `Cart.tsx`, `Checkout.tsx`, `OrderDetail.tsx`
- Guest continuity: `client/src/context/ShopContext.tsx`, `client/src/utils/guestMerge.ts`
- Fulfillment, payment, notifications, and feedback: `server/src/controllers/order.ts`, `server/src/services/mailer.ts`
- Inventory and procurement: `server/src/controllers/lowStock.ts`, `purchase.ts`, `client/src/pages/admin/LowStock.tsx`, `Purchases.tsx`
- Analytics and accountability: `server/src/controllers/analytics.ts`, `auditLog.ts`, `client/src/pages/admin/Analytics.tsx`
- Recommendations and demand flags: `server/src/services/scheduler.ts`, `server/src/controllers/recommendation.ts`

## Validation results

- Canonical timing and word counts: **PASSED**
- Cross-file slide/title/presenter/script/duration/cue synchronization: **PASSED**
- PowerPoint render QA: **PASSED** — all six slides inspected at 1600×900; no clipping, overflow, overlap, or unreadable audience text found.
- Screenshot provenance and embedding: **PASSED**
- Audience-only PowerPoint content: **PASSED**
- **PowerPoint speaker-note validation: PASSED**

Automated validation details are recorded in `validation-results.json`.
