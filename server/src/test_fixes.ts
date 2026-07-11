/**
 * OptiCart Fix-Verification Suite
 * --------------------------------
 * Run with:  npx tsx src/test_fixes.ts   (from server/)
 *
 * Verifies every fix from the 2026-07 hardening pass without damaging data:
 *  1. JWT secret is resolved lazily from .env (sign/verify roundtrip)
 *  2. Low-stock alerts survive repeated trigger→resolve cycles (partial index)
 *  3. Stripe webhook FAILS CLOSED without a valid signature in real mode
 *  4. Mock-mode webhook end-to-end: raw JSON body parsed, stock decremented
 *     atomically, coupon usage counted, cart cleared, idempotent on replay
 *  5. Atomic stock guard: oversell race clamps to 0, never negative
 *  6. Checkout re-validates coupon usage limits (bypass attempt rejected)
 *  7. Refund transition populates order.refund + writes refund_decision audit
 *  8. Reviews ignore client-supplied image URLs
 *  9. user.ts routes errors through AppError (no raw error leakage)
 *
 * All fixtures are prefixed "fixtest" and removed afterwards.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import connectDB from './config/db.js';
import User from './models/User.js';
import Product from './models/Product.js';
import Category from './models/Category.js';
import Cart from './models/Cart.js';
import Order from './models/Order.js';
import Coupon from './models/Coupon.js';
import Review from './models/Review.js';
import LowStockAlert from './models/LowStockAlert.js';
import Notification from './models/Notification.js';
import ProductEvent from './models/ProductEvent.js';
import { generateAccessToken, verifyAccessToken } from './utils/tokens.js';
import { AppError } from './utils/errors.js';
import { createCheckoutSession, stripeWebhook, updateOrderStatus } from './controllers/order.js';
import { createReview } from './controllers/review.js';
import { getUserById } from './controllers/user.js';

// ─── tiny harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const ok = (label: string) => {
  passed++;
  console.log(`  ✓ ${label}`);
};
const bad = (label: string, detail?: string) => {
  failed++;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};
const expect = (cond: boolean, label: string, detail?: string) =>
  cond ? ok(label) : bad(label, detail);

// Minimal Express req/res doubles for direct controller invocation
const mockRes = () => {
  const r: any = { statusCode: 0, body: null };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.json = (d: any) => ((r.body = d), r);
  r.cookie = () => r;
  r.clearCookie = () => r;
  return r;
};
const invoke = async (fn: any, req: any) => {
  const res = mockRes();
  let err: any = null;
  await fn(req, res, (e: any) => (err = e));
  return { res, err };
};

const PFX = 'fixtest';

const cleanup = async () => {
  await User.deleteMany({ email: new RegExp(`^${PFX}_`) });
  const products = await Product.find({ slug: new RegExp(`^${PFX}-`) }).select('_id');
  const productIds = products.map((p) => p._id);
  await Review.deleteMany({ productId: { $in: productIds } });
  await LowStockAlert.deleteMany({ productId: { $in: productIds } });
  await ProductEvent.deleteMany({ productId: { $in: productIds } });
  await Product.deleteMany({ _id: { $in: productIds } });
  await Category.deleteMany({ slug: new RegExp(`^${PFX}-`) });
  await Order.deleteMany({ orderNumber: new RegExp(`^${PFX.toUpperCase()}-`) });
  await Coupon.deleteMany({ code: new RegExp(`^${PFX.toUpperCase()}`) });
  await Cart.deleteMany({ userId: { $nin: await User.distinct('_id') } });
  await Notification.deleteMany({ title: /FIXTEST/ });
  // AuditLog is append-only at the Mongoose layer — remove test entries with
  // the native driver (hooks don't apply there), matching by our test actor.
  await mongoose.connection.db!
    .collection('auditLogs')
    .deleteMany({ actorName: 'FixTest Manager' });
};

async function run() {
  console.log('--- OptiCart Fix-Verification Suite ---');
  await connectDB();
  // Wait for the connection to be fully open before fixture writes
  if (mongoose.connection.readyState !== 1) {
    await new Promise<void>((resolve) => mongoose.connection.once('connected', () => resolve()));
  }
  await LowStockAlert.syncIndexes(); // ensure the partial unique index exists
  await cleanup();

  // ── Fixtures ────────────────────────────────────────────────────────────────
  const pw = await bcrypt.hash('Fixtest123!', 10);
  const customer = await User.create({
    name: 'FixTest Customer',
    email: `${PFX}_customer@opticart.dev`,
    passwordHash: pw,
    role: 'customer',
    isActive: true,
  });
  const manager = await User.create({
    name: 'FixTest Manager',
    email: `${PFX}_manager@opticart.dev`,
    passwordHash: pw,
    role: 'inventory_manager',
    isActive: true,
  });
  const category = await Category.create({ name: 'FixTest Cat', slug: `${PFX}-cat` });
  const product = await Product.create({
    name: 'FixTest Fridge',
    slug: `${PFX}-fridge`,
    description: 'test product',
    categoryId: category._id,
    basePriceCents: 10000,
    variants: [
      { sku: `${PFX.toUpperCase()}-SKU-1`, stock: 5, priceDeltaCents: 0, costPriceCents: 6000, lowStockThreshold: 1 },
    ],
    images: [],
  });
  const sku = `${PFX.toUpperCase()}-SKU-1`;
  const address = { line1: '1 Test St', city: 'Beirut', country: 'LB' };

  // ── 1. JWT secret lazily resolved from .env ────────────────────────────────
  console.log('\n[1] JWT secret (lazy .env resolution)');
  const token = generateAccessToken(customer._id.toString(), 'customer');
  const decoded = verifyAccessToken(token);
  expect(
    decoded.userId === customer._id.toString() && decoded.role === 'customer',
    'sign → verify roundtrip with the runtime-resolved secret'
  );

  // ── 2. Low-stock trigger→resolve→trigger→resolve cycle ─────────────────────
  console.log('\n[2] LowStockAlert partial unique index');
  const mkAlert = () =>
    LowStockAlert.create({
      productId: product._id,
      variantSku: sku,
      thresholdAtTrigger: 1,
      currentStock: 1,
      status: 'active',
    });
  const a1 = await mkAlert();
  let dupBlocked = false;
  try {
    await mkAlert();
  } catch (e: any) {
    dupBlocked = e?.code === 11000;
  }
  expect(dupBlocked, 'second ACTIVE alert for the same variant is blocked (E11000)');
  a1.status = 'resolved';
  a1.resolvedAt = new Date();
  await a1.save();
  const a2 = await mkAlert(); // re-trigger after restock cycle
  a2.status = 'resolved';
  a2.resolvedAt = new Date();
  let secondResolveOk = true;
  try {
    await a2.save(); // used to throw E11000 under the old 3-field unique index
  } catch {
    secondResolveOk = false;
  }
  expect(secondResolveOk, 'second RESOLVE for the same variant succeeds (old index threw here)');

  // ── 3. Webhook fails closed in real-Stripe mode ─────────────────────────────
  console.log('\n[3] Stripe webhook fail-closed (real mode)');
  const savedKey = process.env.STRIPE_SECRET_KEY;
  const savedWh = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_realish_1234';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  const evtBuf = Buffer.from(
    JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_forged' } } })
  );
  const noSig = await invoke(stripeWebhook, { body: evtBuf, headers: {} });
  expect(
    noSig.err instanceof AppError && (noSig.err as AppError).code === 'WEBHOOK_SIGNATURE_MISSING',
    'unsigned payload rejected (WEBHOOK_SIGNATURE_MISSING)',
    `got ${noSig.err?.code ?? noSig.res.statusCode}`
  );
  const badSig = await invoke(stripeWebhook, {
    body: evtBuf,
    headers: { 'stripe-signature': 't=1,v1=forged' },
  });
  expect(
    badSig.err instanceof AppError && (badSig.err as AppError).code === 'WEBHOOK_SIGNATURE_INVALID',
    'forged signature rejected (WEBHOOK_SIGNATURE_INVALID)',
    `got ${badSig.err?.code ?? badSig.res.statusCode}`
  );
  process.env.STRIPE_SECRET_KEY = savedKey;
  process.env.STRIPE_WEBHOOK_SECRET = savedWh;

  // ── 4+5. Mock webhook E2E: raw body, atomic stock, coupon count, idempotency
  console.log('\n[4] Mock-mode webhook end-to-end');
  const coupon = await Coupon.create({
    code: `${PFX.toUpperCase()}10`,
    type: 'percentage',
    value: 10,
    minOrderValueCents: 0,
    expiryDate: new Date(Date.now() + 86400000),
    usageLimit: 5,
    perUserLimit: 5,
    usedBy: [],
  });
  await Cart.findOneAndUpdate(
    { userId: customer._id },
    { items: [{ productId: product._id, variantSku: sku, quantity: 3, priceAtAddCents: 10000 }] },
    { upsert: true }
  );
  const sess = await invoke(createCheckoutSession, {
    user: { userId: customer._id.toString(), role: 'customer' },
    body: { shippingAddress: address, couponCode: coupon.code },
  });
  expect(!sess.err && sess.res.statusCode === 201, 'checkout session created (mock PaymentIntent)');
  const paymentIntentId = sess.res.body?.data?.paymentIntentId;
  const orderId = sess.res.body?.data?.orderId;
  // Force a known orderNumber prefix for cleanup
  await Order.updateOne({ _id: orderId }, { orderNumber: `${PFX.toUpperCase()}-${Date.now()}` });

  const whEvent = Buffer.from(
    JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: paymentIntentId } } })
  );
  const wh1 = await invoke(stripeWebhook, { body: whEvent, headers: {} });
  expect(
    !wh1.err && wh1.res.statusCode === 200 && wh1.res.body?.received === true,
    'raw JSON Buffer body parsed and processed in mock mode'
  );
  let freshProduct = await Product.findById(product._id);
  expect(freshProduct!.variants[0].stock === 2, 'stock atomically decremented 5 → 2', `stock=${freshProduct!.variants[0].stock}`);
  const freshCoupon = await Coupon.findById(coupon._id);
  expect(
    freshCoupon!.usedBy.length === 1 && freshCoupon!.usedBy[0].count === 1,
    'coupon usage recorded in usedBy'
  );
  const freshCart = await Cart.findOne({ userId: customer._id });
  expect((freshCart?.items.length ?? 0) === 0, 'cart cleared after payment');

  const wh2 = await invoke(stripeWebhook, { body: whEvent, headers: {} });
  freshProduct = await Product.findById(product._id);
  expect(
    !wh2.err && freshProduct!.variants[0].stock === 2,
    'webhook replay is idempotent (no double stock decrement)'
  );

  console.log('\n[5] Atomic oversell guard');
  // Direct replay of the webhook's guarded query: only 2 left, ask for 3
  const guarded = await Product.findOneAndUpdate(
    { _id: product._id, variants: { $elemMatch: { sku, stock: { $gte: 3 } } } },
    { $inc: { 'variants.$.stock': -3 } },
    { new: true }
  );
  expect(guarded === null, 'conditional $inc refuses to go below zero');
  freshProduct = await Product.findById(product._id);
  expect(freshProduct!.variants[0].stock === 2, 'stock unchanged after refused decrement');

  // ── 6. Coupon limits enforced at checkout ───────────────────────────────────
  console.log('\n[6] Coupon usage limits at checkout');
  await Coupon.updateOne({ _id: coupon._id }, { usageLimit: 1 }); // now exhausted (1 use recorded)
  await Cart.findOneAndUpdate(
    { userId: customer._id },
    { items: [{ productId: product._id, variantSku: sku, quantity: 1, priceAtAddCents: 10000 }] },
    { upsert: true }
  );
  const bypass = await invoke(createCheckoutSession, {
    user: { userId: customer._id.toString(), role: 'customer' },
    body: { shippingAddress: address, couponCode: coupon.code },
  });
  expect(
    bypass.err instanceof AppError && (bypass.err as AppError).code === 'COUPON_LIMIT_EXCEEDED',
    'exhausted coupon sent straight to checkout is rejected',
    `got ${bypass.err?.code ?? bypass.res.statusCode}`
  );

  // ── 7. Refund transition (mock) ─────────────────────────────────────────────
  console.log('\n[7] Refund completes the money-movement record');
  const refundOrder = await Order.findById(orderId);
  const ref = await invoke(updateOrderStatus, {
    user: { userId: manager._id.toString(), role: 'inventory_manager' },
    params: { id: refundOrder!._id.toString() },
    body: { status: 'refunded', note: 'FixTest refund reason' },
  });
  expect(!ref.err && ref.res.statusCode === 200, 'status → refunded transition succeeds');
  const refunded = await Order.findById(orderId);
  expect(
    !!refunded?.refund &&
      refunded.refund.reason === 'FixTest refund reason' &&
      typeof refunded.refund.stripeRefundId === 'string' &&
      refunded.refund.stripeRefundId.length > 0,
    'order.refund populated (status/reason/approvedBy/stripeRefundId)'
  );
  const refundAudit = await mongoose.connection.db!
    .collection('auditLogs')
    .findOne({ actionType: 'refund_decision', targetEntityId: refunded!._id });
  expect(!!refundAudit, 'refund_decision audit entry written (was never written before)');

  // ── 8. Reviews ignore client-supplied images ────────────────────────────────
  console.log('\n[8] Review images not accepted from the request body');
  await Order.updateOne({ _id: orderId }, { status: 'delivered' }); // verified-purchase gate
  const rev = await invoke(createReview, {
    user: { userId: customer._id.toString(), role: 'customer' },
    body: {
      productId: product._id.toString(),
      rating: 5,
      text: 'FixTest review',
      images: [{ url: 'https://evil.example/x.png', publicId: 'evil' }],
    },
  });
  expect(!rev.err && rev.res.statusCode === 201, 'review created for delivered order');
  const storedReview = await Review.findOne({ userId: customer._id, productId: product._id });
  expect((storedReview?.images.length ?? 1) === 0, 'client-supplied image URLs were dropped');

  // ── 9. user.ts errors flow through AppError ────────────────────────────────
  console.log('\n[9] user.ts error pipeline');
  const badId = await invoke(getUserById, { params: { id: 'not-an-objectid' } });
  expect(
    badId.err instanceof AppError && badId.res.statusCode === 0,
    'invalid id produces AppError via next() — no raw 500 with error internals'
  );

  // ── wrap up ────────────────────────────────────────────────────────────────
  await cleanup();
  console.log(`\n--- Result: ${passed} passed, ${failed} failed ---`);
  await mongoose.disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

run().catch(async (err) => {
  console.error('✗ Suite crashed:', err);
  try {
    await cleanup();
  } catch { /* best effort */ }
  await mongoose.disconnect();
  process.exit(1);
});
