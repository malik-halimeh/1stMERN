/**
 * OptiCart Seed Script
 * ---------------------
 * Run with:  npm run seed
 *
 * Seeds:
 *  - 3 users (1 per role)
 *  - 4 categories (2 parent + 2 child)
 *  - 12 products with 2-3 variants each
 *  - 5 orders across different statuses
 *  - 8 reviews (only on delivered-order products)
 *  - 2 active coupons
 *  - 1 active low-stock alert
 *
 * ⚠ This script DROPS all existing data before seeding.
 *   Use ONLY in development/test environments.
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Models
import User from './src/models/User.js';
import Category from './src/models/Category.js';
import Product from './src/models/Product.js';
import Order from './src/models/Order.js';
import Review from './src/models/Review.js';
import Coupon from './src/models/Coupon.js';
import LowStockAlert from './src/models/LowStockAlert.js';
import Cart from './src/models/Cart.js';
import Wishlist from './src/models/Wishlist.js';
import ProductEvent from './src/models/ProductEvent.js';
import ProductRecommendation from './src/models/ProductRecommendation.js';
import AuditLog from './src/models/AuditLog.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/opticart';

// ─── Placeholder image helper ─────────────────────────────────────────────────
const img = (name: string) => ({
  url: `https://placehold.co/800x600/1a1a2e/ffffff?text=${encodeURIComponent(name)}`,
  publicId: `opticart_seed_${name.toLowerCase().replace(/\s+/g, '_')}`,
});

// ─── Main seed function ───────────────────────────────────────────────────────
const seed = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB:', MONGO_URI);

  // ── Drop all collections ──────────────────────────────────────────────────
  // AuditLog has append-only middleware that blocks deleteMany,
  // so we drop it at the native driver level.
  const db = mongoose.connection.db!;
  const safeDrop = async (colName: string) => {
    try { await db.collection(colName).drop(); } catch { /* collection may not exist yet */ }
  };

  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Order.deleteMany({}),
    Review.deleteMany({}),
    Coupon.deleteMany({}),
    LowStockAlert.deleteMany({}),
    Cart.deleteMany({}),
    Wishlist.deleteMany({}),
    ProductEvent.deleteMany({}),
    ProductRecommendation.deleteMany({}),
    safeDrop('auditLogs'),
  ]);
  console.log('✓ Cleared all collections');


  // ──────────────────────────────────────────────────────────────────────────
  // 1. USERS
  // ──────────────────────────────────────────────────────────────────────────
  const hashPw = (pw: string) => bcrypt.hashSync(pw, 10);

  const [customer, manager, admin] = await User.insertMany([
    {
      name: 'Alex Carter',
      email: 'customer@opticart.dev',
      passwordHash: hashPw('Customer123!'),
      role: 'customer',
      isActive: true,
      addresses: [
        { label: 'Home', line1: '12 Oak Street', city: 'New York', country: 'US', isDefault: true },
      ],
    },
    {
      name: 'Jordan Lee',
      email: 'manager@opticart.dev',
      passwordHash: hashPw('Manager123!'),
      role: 'inventory_manager',
      isActive: true,
      addresses: [],
    },
    {
      name: 'Sam Rivera',
      email: 'admin@opticart.dev',
      passwordHash: hashPw('Admin123!'),
      role: 'super_admin',
      isActive: true,
      addresses: [],
    },
  ]);
  console.log('✓ Users seeded (3)');

  // ──────────────────────────────────────────────────────────────────────────
  // 2. CATEGORIES — 2 parent, 2 child
  // ──────────────────────────────────────────────────────────────────────────
  const [catCooling, catCooking] = await Category.insertMany([
    { name: 'Cooling & Refrigeration', slug: 'cooling-refrigeration' },
    { name: 'Cooking Appliances', slug: 'cooking-appliances' },
  ]);

  const [catFridge, catOven] = await Category.insertMany([
    { name: 'Refrigerators', slug: 'refrigerators', parentId: catCooling._id },
    { name: 'Ovens & Cooktops', slug: 'ovens-cooktops', parentId: catCooking._id },
  ]);
  console.log('✓ Categories seeded (4 — 2 parent, 2 child)');

  // ──────────────────────────────────────────────────────────────────────────
  // 3. PRODUCTS — 12 products, 2-3 variants each
  // ──────────────────────────────────────────────────────────────────────────
  const products = await Product.insertMany([
    // ── Refrigerators (6) ──
    {
      name: 'OptiCool FrostFree 500L',
      slug: 'opticool-frostfree-500l',
      description: 'A spacious 500-litre frost-free refrigerator with dual compressor and SmartCool technology.',
      brand: 'OptiHome',
      categoryId: catFridge._id,
      basePriceCents: 129900,
      isTrending: true,
      isMostSelling: false,
      searchKeywords: ['refrigerator', 'frost-free', 'double door'],
      images: [img('FrostFree 500L'), img('FrostFree 500L Side')],
      variants: [
        { sku: 'OCFF-500-SS', color: 'Stainless Steel', stock: 25, priceDeltaCents: 0, costPriceCents: 75000, lowStockThreshold: 5 },
        { sku: 'OCFF-500-BL', color: 'Matte Black', stock: 12, priceDeltaCents: 2000, costPriceCents: 77000, lowStockThreshold: 5 },
      ],
    },
    {
      name: 'OptiCool Compact 200L',
      slug: 'opticool-compact-200l',
      description: 'Ideal single-door compact refrigerator for small kitchens and studio apartments.',
      brand: 'OptiHome',
      categoryId: catFridge._id,
      basePriceCents: 44900,
      isTrending: false,
      isMostSelling: true,
      searchKeywords: ['mini fridge', 'compact', 'single door'],
      images: [img('Compact 200L')],
      variants: [
        { sku: 'OCCP-200-WH', color: 'White', stock: 40, priceDeltaCents: 0, costPriceCents: 26000, lowStockThreshold: 8 },
        { sku: 'OCCP-200-SV', color: 'Silver', stock: 18, priceDeltaCents: 1500, costPriceCents: 27500, lowStockThreshold: 8 },
        { sku: 'OCCP-200-GR', color: 'Graphite', stock: 9, priceDeltaCents: 2000, costPriceCents: 28000, lowStockThreshold: 8 },
      ],
    },
    {
      name: 'OptiCool French Door 650L',
      slug: 'opticool-french-door-650l',
      description: 'Premium French-door refrigerator with bottom freezer and TouchPanel display.',
      brand: 'OptiHome',
      categoryId: catFridge._id,
      basePriceCents: 219900,
      isTrending: true,
      isMostSelling: false,
      searchKeywords: ['french door', 'luxury fridge', 'bottom freezer'],
      images: [img('French Door 650L')],
      variants: [
        { sku: 'OCFD-650-SS', color: 'Stainless Steel', stock: 8, priceDeltaCents: 0, costPriceCents: 130000, lowStockThreshold: 3 },
        { sku: 'OCFD-650-BK', color: 'Piano Black', stock: 4, priceDeltaCents: 5000, costPriceCents: 135000, lowStockThreshold: 3 },
      ],
    },
    {
      name: 'OptiCool Side-by-Side 580L',
      slug: 'opticool-side-by-side-580l',
      description: 'Wide-format side-by-side with built-in water dispenser and ice maker.',
      brand: 'OptiHome',
      categoryId: catFridge._id,
      basePriceCents: 179900,
      isTrending: false,
      isMostSelling: true,
      searchKeywords: ['side by side', 'ice maker', 'water dispenser'],
      images: [img('Side-by-Side 580L')],
      variants: [
        { sku: 'OCSBS-580-SS', color: 'Stainless Steel', stock: 15, priceDeltaCents: 0, costPriceCents: 105000, lowStockThreshold: 4 },
      ],
    },
    {
      name: 'OptiCool QuietZone 320L',
      slug: 'opticool-quietzone-320l',
      description: 'Ultra-quiet (<38dB) two-door fridge with AirPure filtration and humidity control.',
      brand: 'OptiHome',
      categoryId: catFridge._id,
      basePriceCents: 89900,
      isTrending: false,
      isMostSelling: false,
      searchKeywords: ['quiet', 'noise free', 'two door fridge'],
      images: [img('QuietZone 320L')],
      variants: [
        { sku: 'OCQZ-320-WH', color: 'White', stock: 20, priceDeltaCents: 0, costPriceCents: 52000, lowStockThreshold: 5 },
        { sku: 'OCQZ-320-SV', color: 'Silver', stock: 11, priceDeltaCents: 1000, costPriceCents: 53000, lowStockThreshold: 5 },
      ],
    },
    {
      name: 'OptiCool Wine Cellar 120 Bottles',
      slug: 'opticool-wine-cellar-120',
      description: 'Dual-zone wine cooler with UV-protected glass door and vibration dampening.',
      brand: 'OptiHome',
      categoryId: catCooling._id,
      basePriceCents: 149900,
      isTrending: true,
      isMostSelling: false,
      searchKeywords: ['wine cooler', 'beverage fridge', 'dual zone'],
      images: [img('Wine Cellar 120')],
      variants: [
        { sku: 'OCWC-120-BK', color: 'Black', stock: 6, priceDeltaCents: 0, costPriceCents: 90000, lowStockThreshold: 2 },
      ],
    },
    // ── Ovens & Cooktops (6) ──
    {
      name: 'OptiChef ConvecPro 60cm Oven',
      slug: 'optichef-convecpro-60cm',
      description: 'Multifunctional convection oven with 10 cooking modes, pyrolytic self-clean.',
      brand: 'OptiChef',
      categoryId: catOven._id,
      basePriceCents: 99900,
      isTrending: true,
      isMostSelling: true,
      searchKeywords: ['convection oven', 'built-in oven', 'self-clean'],
      images: [img('ConvecPro Oven')],
      variants: [
        { sku: 'OCCP-60-SS', color: 'Stainless Steel', stock: 22, priceDeltaCents: 0, costPriceCents: 58000, lowStockThreshold: 5 },
        { sku: 'OCCP-60-BK', color: 'Matte Black', stock: 10, priceDeltaCents: 2000, costPriceCents: 60000, lowStockThreshold: 5 },
      ],
    },
    {
      name: 'OptiChef InductaFlame 4-Zone Cooktop',
      slug: 'optichef-inductaflame-4zone',
      description: 'Ultra-responsive 4-zone induction cooktop with boost function and childproof lock.',
      brand: 'OptiChef',
      categoryId: catOven._id,
      basePriceCents: 69900,
      isTrending: false,
      isMostSelling: true,
      searchKeywords: ['induction', 'cooktop', '4 zone', 'boost'],
      images: [img('InductaFlame Cooktop')],
      variants: [
        { sku: 'OCIF-4Z-BK', color: 'Black', stock: 30, priceDeltaCents: 0, costPriceCents: 40000, lowStockThreshold: 6 },
      ],
    },
    {
      name: 'OptiChef MicroWave Pro 32L',
      slug: 'optichef-microwave-pro-32l',
      description: '32-litre combination microwave with grill and convection functions.',
      brand: 'OptiChef',
      categoryId: catCooking._id,
      basePriceCents: 34900,
      isTrending: false,
      isMostSelling: false,
      searchKeywords: ['microwave', 'combination', 'grill', 'convection'],
      images: [img('MicroWave Pro 32L')],
      variants: [
        { sku: 'OCMW-32-SS', color: 'Stainless Steel', stock: 35, priceDeltaCents: 0, costPriceCents: 20000, lowStockThreshold: 8 },
        { sku: 'OCMW-32-WH', color: 'White', stock: 28, priceDeltaCents: -500, costPriceCents: 19500, lowStockThreshold: 8 },
      ],
    },
    {
      name: 'OptiChef AirFryer Max 8L',
      slug: 'optichef-airfryer-max-8l',
      description: '8-litre digital air fryer with 12 preset programs and rapid air circulation.',
      brand: 'OptiChef',
      categoryId: catCooking._id,
      basePriceCents: 24900,
      isTrending: false,
      isMostSelling: false,
      searchKeywords: ['air fryer', 'healthy cooking', 'digital'],
      images: [img('AirFryer Max 8L')],
      variants: [
        { sku: 'OCAF-8L-BK', color: 'Black', stock: 3, priceDeltaCents: 0, costPriceCents: 14000, lowStockThreshold: 5 }, // LOW STOCK seed
        { sku: 'OCAF-8L-WH', color: 'White', stock: 20, priceDeltaCents: 0, costPriceCents: 14000, lowStockThreshold: 5 },
      ],
    },
    {
      name: 'OptiChef SteamBake 45cm Oven',
      slug: 'optichef-steambake-45cm',
      description: '45cm combi-steam oven with sous-vide cooking and programmed recipe library.',
      brand: 'OptiChef',
      categoryId: catOven._id,
      basePriceCents: 149900,
      isTrending: false,
      isMostSelling: false,
      searchKeywords: ['steam oven', 'combi', 'sous-vide'],
      images: [img('SteamBake 45cm')],
      variants: [
        { sku: 'OCSB-45-SS', color: 'Stainless Steel', stock: 7, priceDeltaCents: 0, costPriceCents: 90000, lowStockThreshold: 3 },
      ],
    },
    {
      name: 'OptiChef Dishwasher SlimLine 45cm',
      slug: 'optichef-dishwasher-slimline-45cm',
      description: 'Slim 45cm dishwasher with 10-place settings, A++ energy rating, and delay start.',
      brand: 'OptiChef',
      categoryId: catCooking._id,
      basePriceCents: 59900,
      isTrending: false,
      isMostSelling: false,
      searchKeywords: ['dishwasher', 'slim', 'energy efficient'],
      images: [img('Dishwasher SlimLine')],
      variants: [
        { sku: 'OCDW-45-WH', color: 'White', stock: 14, priceDeltaCents: 0, costPriceCents: 35000, lowStockThreshold: 5 },
        { sku: 'OCDW-45-SS', color: 'Stainless Steel', stock: 9, priceDeltaCents: 3000, costPriceCents: 37000, lowStockThreshold: 5 },
      ],
    },
  ]);
  console.log('✓ Products seeded (12)');

  // Helpers
  const p = (name: string) => products.find((p) => p.name.includes(name))!;

  const shippingAddress = {
    label: 'Home',
    line1: '12 Oak Street',
    city: 'New York',
    country: 'US',
  };

  const mkItem = (prod: any, sku: string, qty: number) => {
    const variant = prod.variants.find((v: any) => v.sku === sku)!;
    return {
      productId: prod._id,
      name: prod.name,
      variantSku: sku,
      unitPriceCents: prod.basePriceCents + variant.priceDeltaCents,
      unitCostCents: variant.costPriceCents,
      quantity: qty,
    };
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 4. ORDERS — 5 orders across statuses: pending, processing, shipped, delivered, cancelled
  // ──────────────────────────────────────────────────────────────────────────
  const fridgeProd = p('FrostFree 500L');
  const ovenProd   = p('ConvecPro');
  const microwaveProd = p('MicroWave');
  const airfryerProd  = p('AirFryer');
  const sidebysideProd = p('Side-by-Side');

  const orderDates = {
    delivered: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    cancelled: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    shipped:   new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    processing:new Date(Date.now() -  5 * 24 * 60 * 60 * 1000),
    pending:   new Date(Date.now() -  1 * 24 * 60 * 60 * 1000),
  };

  const [
    orderDelivered,
    orderCancelled,
    orderShipped,
    orderProcessing,
    orderPending,
  ] = await Order.insertMany([
    {
      orderNumber: 'ORD-100001',
      userId: customer._id,
      items: [mkItem(fridgeProd, 'OCFF-500-SS', 1)],
      subtotalCents: 129900,
      discountCents: 0,
      totalCents: 129900,
      shippingAddress,
      status: 'delivered',
      paymentStatus: 'succeeded',
      paymentIntentId: 'seed_pi_delivered',
      deliveredAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      statusHistory: [
        { status: 'confirmed', timestamp: orderDates.delivered, updatedBy: manager._id },
        { status: 'shipped',   timestamp: new Date(orderDates.delivered.getTime() + 2 * 86400000), updatedBy: manager._id },
        { status: 'delivered', timestamp: new Date(orderDates.delivered.getTime() + 5 * 86400000), updatedBy: manager._id },
      ],
      createdAt: orderDates.delivered,
    },
    {
      orderNumber: 'ORD-100002',
      userId: customer._id,
      items: [mkItem(ovenProd, 'OCCP-60-SS', 1)],
      subtotalCents: 99900,
      discountCents: 0,
      totalCents: 99900,
      shippingAddress,
      status: 'cancelled',
      paymentStatus: 'failed',
      paymentIntentId: 'seed_pi_cancelled',
      cancelledAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      statusHistory: [
        { status: 'confirmed',  timestamp: orderDates.cancelled, updatedBy: manager._id },
        { status: 'cancelled',  timestamp: new Date(orderDates.cancelled.getTime() + 2 * 86400000), updatedBy: manager._id },
      ],
      createdAt: orderDates.cancelled,
    },
    {
      orderNumber: 'ORD-100003',
      userId: customer._id,
      items: [mkItem(microwaveProd, 'OCMW-32-SS', 2)],
      subtotalCents: 69800,
      discountCents: 0,
      totalCents: 69800,
      shippingAddress,
      status: 'shipped',
      paymentStatus: 'succeeded',
      paymentIntentId: 'seed_pi_shipped',
      statusHistory: [
        { status: 'confirmed',  timestamp: orderDates.shipped, updatedBy: manager._id },
        { status: 'processing', timestamp: new Date(orderDates.shipped.getTime() + 1 * 86400000), updatedBy: manager._id },
        { status: 'shipped',    timestamp: new Date(orderDates.shipped.getTime() + 3 * 86400000), updatedBy: manager._id },
      ],
      createdAt: orderDates.shipped,
    },
    {
      orderNumber: 'ORD-100004',
      userId: customer._id,
      items: [mkItem(airfryerProd, 'OCAF-8L-BK', 1), mkItem(microwaveProd, 'OCMW-32-WH', 1)],
      subtotalCents: 59400,
      discountCents: 5940,
      totalCents: 53460,
      couponCode: 'SAVE10',
      shippingAddress,
      status: 'processing',
      paymentStatus: 'succeeded',
      paymentIntentId: 'seed_pi_processing',
      statusHistory: [
        { status: 'confirmed',  timestamp: orderDates.processing, updatedBy: manager._id },
        { status: 'processing', timestamp: new Date(orderDates.processing.getTime() + 1 * 86400000), updatedBy: manager._id },
      ],
      createdAt: orderDates.processing,
    },
    {
      orderNumber: 'ORD-100005',
      userId: customer._id,
      items: [mkItem(sidebysideProd, 'OCSBS-580-SS', 1)],
      subtotalCents: 179900,
      discountCents: 0,
      totalCents: 179900,
      shippingAddress,
      status: 'pending',
      paymentStatus: 'pending',
      paymentIntentId: 'seed_pi_pending',
      statusHistory: [],
      createdAt: orderDates.pending,
    },
  ]);
  console.log('✓ Orders seeded (5 — pending/processing/shipped/delivered/cancelled)');

  // ──────────────────────────────────────────────────────────────────────────
  // 5. REVIEWS — 8 reviews, only on delivered-order products, verified purchase
  // ──────────────────────────────────────────────────────────────────────────
  // orderDelivered contains fridgeProd (OCFF-500-SS)
  // We seed additional 7 reviews for the other products by creating extra delivered orders first
  // in the DB directly (bypassing payment for seed purposes)

  const mkDeliveredOrder = async (prod: any, sku: string) => {
    const item = mkItem(prod, sku, 1);
    return Order.create({
      orderNumber: `ORD-SEED-${Math.floor(Math.random() * 900000 + 100000)}`,
      userId: customer._id,
      items: [item],
      subtotalCents: item.unitPriceCents,
      discountCents: 0,
      totalCents: item.unitPriceCents,
      shippingAddress,
      status: 'delivered',
      paymentStatus: 'succeeded',
      paymentIntentId: `seed_pi_rev_${Math.random().toString(36).substr(2, 8)}`,
      deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      statusHistory: [],
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    });
  };

  const reviewProducts = [
    { prod: ovenProd,        sku: 'OCCP-60-SS',   rating: 5, text: 'Exceptional convection performance. Bakes evenly every time. Pyrolytic clean is a game-changer.' },
    { prod: microwaveProd,   sku: 'OCMW-32-SS',   rating: 4, text: 'Compact yet powerful. The grill mode gives restaurant-quality results. Great value.' },
    { prod: airfryerProd,    sku: 'OCAF-8L-WH',   rating: 5, text: 'Best air fryer I have owned. Crispy results in half the time. Easy to clean basket.' },
    { prod: sidebysideProd,  sku: 'OCSBS-580-SS', rating: 4, text: 'Impressive size and storage. The ice maker works flawlessly. Very quiet compressor.' },
    { prod: p('Compact 200L'), sku: 'OCCP-200-WH', rating: 3, text: 'Good for small spaces. Cooling is consistent. Wish it had a separate freezer compartment.' },
    { prod: p('French Door'),  sku: 'OCFD-650-SS', rating: 5, text: 'Absolutely stunning refrigerator. The TouchPanel display is intuitive and the capacity is enormous.' },
    { prod: p('InductaFlame'), sku: 'OCIF-4Z-BK',  rating: 4, text: 'Responsive induction zones. Boost mode heats water in seconds. Childproof lock is essential with kids.' },
  ];

  // Create auxiliary delivered orders and reviews
  const reviewsData = [];

  // First review: on the main delivered order
  reviewsData.push({
    productId: fridgeProd._id,
    userId: customer._id,
    orderId: orderDelivered._id,
    rating: 5,
    text: 'Fantastic refrigerator! The frost-free system works perfectly and it keeps everything at optimal temperature.',
    images: [],
    isFlagged: false,
    isRemoved: false,
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
  });

  for (const { prod, sku, rating, text } of reviewProducts) {
    const order = await mkDeliveredOrder(prod, sku);
    reviewsData.push({
      productId: prod._id,
      userId: customer._id,
      orderId: order._id,
      rating,
      text,
      images: [],
      isFlagged: false,
      isRemoved: false,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });
  }

  await Review.insertMany(reviewsData);

  // Update denormalized ratingAvg and reviewCount on each product
  const reviewsByProduct = new Map<string, number[]>();
  for (const r of reviewsData) {
    const pid = r.productId.toString();
    if (!reviewsByProduct.has(pid)) reviewsByProduct.set(pid, []);
    reviewsByProduct.get(pid)!.push(r.rating);
  }
  for (const [pid, ratings] of reviewsByProduct.entries()) {
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    await Product.findByIdAndUpdate(pid, {
      ratingAvg: parseFloat(avg.toFixed(2)),
      reviewCount: ratings.length,
    });
  }
  console.log('✓ Reviews seeded (8) — all on delivered-order products');

  // ──────────────────────────────────────────────────────────────────────────
  // 6. COUPONS — 2 active
  // ──────────────────────────────────────────────────────────────────────────
  await Coupon.insertMany([
    {
      code: 'SAVE10',
      type: 'percentage',
      value: 10,
      minOrderValueCents: 5000,
      expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      usageLimit: 500,
      perUserLimit: 3,
      usedBy: [],
      isActive: true,
    },
    {
      code: 'FLAT50',
      type: 'fixed',
      value: 5000, // $50 off
      minOrderValueCents: 50000,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      usageLimit: 100,
      perUserLimit: 1,
      usedBy: [],
      isActive: true,
    },
  ]);
  console.log('✓ Coupons seeded (2 active)');

  // ──────────────────────────────────────────────────────────────────────────
  // 7. LOW-STOCK ALERT — seed airfryer Black variant at stock=3, threshold=5
  // ──────────────────────────────────────────────────────────────────────────
  await LowStockAlert.create({
    productId: airfryerProd._id,
    variantSku: 'OCAF-8L-BK',
    thresholdAtTrigger: 5,
    currentStock: 3,
    status: 'active',
    createdAt: new Date(),
  });
  console.log('✓ Low-stock alert seeded (AirFryer Max 8L — Black, stock=3/threshold=5)');

  // ──────────────────────────────────────────────────────────────────────────
  // Done
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test Credentials:');
  console.log('  Customer  →  customer@opticart.dev  /  Customer123!');
  console.log('  Manager   →  manager@opticart.dev   /  Manager123!');
  console.log('  Admin     →  admin@opticart.dev     /  Admin123!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
