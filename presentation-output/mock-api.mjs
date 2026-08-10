import http from 'node:http';

const PORT = 5055;
const now = new Date('2026-08-11T10:00:00Z');
const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString();

const products = [
  {
    _id: 'p1', name: 'OptiHome French Door Refrigerator', slug: 'optihome-french-door-refrigerator',
    brand: 'OptiHome', description: 'Energy-efficient cooling with flexible storage.',
    basePriceCents: 189900, ratingAvg: 4.8, reviewCount: 126, isTrending: true, isMostSelling: true,
    variants: [{ sku: 'REF-FD-SS', color: 'Stainless Steel', capacity: '520 L', stock: 8, priceDeltaCents: 0, lowStockThreshold: 10,
      images: [{ url: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&q=85&w=900', publicId: 'sample-ref' }] }]
  },
  {
    _id: 'p2', name: 'Precision Convection Oven', slug: 'precision-convection-oven',
    brand: 'OptiHome', description: 'Even cooking with intuitive controls.',
    basePriceCents: 119900, ratingAvg: 4.7, reviewCount: 89, isTrending: true, isMostSelling: false,
    variants: [{ sku: 'OVN-CV-BK', color: 'Matte Black', capacity: '72 L', stock: 22, priceDeltaCents: 0, lowStockThreshold: 8,
      images: [{ url: 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&q=85&w=900', publicId: 'sample-oven' }] }]
  },
  {
    _id: 'p3', name: 'QuietClean Dishwasher', slug: 'quietclean-dishwasher',
    brand: 'OptiHome', description: 'Quiet cycles and flexible rack space.',
    basePriceCents: 84900, ratingAvg: 4.6, reviewCount: 74, isTrending: false, isMostSelling: true,
    variants: [{ sku: 'DSH-QC-SS', color: 'Stainless Steel', capacity: '14 Place Settings', stock: 17, priceDeltaCents: 0, lowStockThreshold: 6,
      images: [{ url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=85&w=900', publicId: 'sample-dishwasher' }] }]
  },
  {
    _id: 'p4', name: 'SteamCare Washer', slug: 'steamcare-washer',
    brand: 'OptiHome', description: 'Efficient fabric care with steam cycles.',
    basePriceCents: 99900, ratingAvg: 4.5, reviewCount: 61, isTrending: false, isMostSelling: false,
    variants: [{ sku: 'WSH-ST-WH', color: 'White', capacity: '10 kg', stock: 5, priceDeltaCents: 0, lowStockThreshold: 7,
      images: [{ url: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&q=85&w=900', publicId: 'sample-washer' }] }]
  }
];

const orders = [
  { _id: 'o1', orderNumber: 'OPT-2026-1048', userId: { name: 'Nadia Saleh', email: 'nadia@example.test' }, items: [{ name: 'OptiHome French Door Refrigerator' }], totalCents: 189900, status: 'processing', createdAt: daysAgo(1), feedback: null },
  { _id: 'o2', orderNumber: 'OPT-2026-1047', userId: { name: 'Karim Haddad', email: 'karim@example.test' }, items: [{ name: 'QuietClean Dishwasher' }], totalCents: 84900, status: 'confirmed', createdAt: daysAgo(2), feedback: null },
  { _id: 'o3', orderNumber: 'OPT-2026-1046', userId: { name: 'Lina Nasser', email: 'lina@example.test' }, items: [{ name: 'Precision Convection Oven' }], totalCents: 119900, status: 'shipped', createdAt: daysAgo(3), feedback: { rating: 5, text: 'Clear updates and an easy order experience.' } },
  { _id: 'o4', orderNumber: 'OPT-2026-1045', userId: { name: 'Omar Hamdan', email: 'omar@example.test' }, items: [{ name: 'SteamCare Washer' }], totalCents: 99900, status: 'delivered', createdAt: daysAgo(5), feedback: { rating: 4, text: 'Delivery tracking was helpful.' } },
  { _id: 'o5', orderNumber: 'OPT-2026-1044', userId: { name: 'Maya Farah', email: 'maya@example.test' }, items: [{ name: 'QuietClean Dishwasher' }], totalCents: 84900, status: 'pending', createdAt: daysAgo(6), feedback: null }
];

const lowStock = [
  { _id: 'a1', productId: { _id: 'p1', name: 'OptiHome French Door Refrigerator' }, variantSku: 'REF-FD-SS', currentStock: 8, threshold: 10, status: 'active', createdAt: daysAgo(1) },
  { _id: 'a2', productId: { _id: 'p4', name: 'SteamCare Washer' }, variantSku: 'WSH-ST-WH', currentStock: 5, threshold: 7, status: 'active', createdAt: daysAgo(2) }
];

const series = [
  ['Jul 13', 420000, 5], ['Jul 17', 680000, 8], ['Jul 21', 510000, 6], ['Jul 25', 890000, 10],
  ['Jul 29', 740000, 9], ['Aug 02', 980000, 11], ['Aug 06', 1120000, 13], ['Aug 10', 1260000, 15]
];

const responseFor = (method, url) => {
  const u = new URL(url, `http://127.0.0.1:${PORT}`);
  const p = u.pathname.replace(/^\/api/, '');
  if (p === '/auth/refresh') return { success: true, data: { accessToken: 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOiJhZG1pbi0xIiwicm9sZSI6InN1cGVyX2FkbWluIn0.' } };
  if (p === '/auth/profile') return { success: true, data: { id: 'admin-1', name: 'OptiCart Admin', email: 'admin@opticart.test', role: 'super_admin', addresses: [] } };
  if (p === '/categories') return { success: true, data: [
    { _id: 'c1', name: 'Refrigeration', slug: 'refrigeration', subcategories: [{ _id: 'c11', name: 'French Door', slug: 'french-door' }] },
    { _id: 'c2', name: 'Cooking', slug: 'cooking', subcategories: [{ _id: 'c21', name: 'Ovens', slug: 'ovens' }] },
    { _id: 'c3', name: 'Dishwashers', slug: 'dishwashers', subcategories: [] },
    { _id: 'c4', name: 'Laundry', slug: 'laundry', subcategories: [] }
  ] };
  if (p === '/product-recommendations') return { success: true, data: products.slice(0, 4) };
  if (p === '/products/by-ids') return { success: true, data: products };
  if (p === '/products') return { success: true, data: products, meta: { page: 1, limit: 20, total: 42, pages: 3 } };
  if (p === '/cart') return { success: true, data: { items: [] } };
  if (p === '/wishlist') return { success: true, data: { items: [] } };
  if (p === '/notifications') return { success: true, data: [], meta: { unread: 0 } };
  if (p === '/orders') {
    const status = u.searchParams.get('status');
    const rows = status ? orders.filter((o) => o.status === status) : orders;
    const total = status === 'pending' ? 7 : 128;
    return { success: true, data: rows, meta: { page: 1, limit: 20, total, pages: 7 } };
  }
  if (p === '/low-stock') return { success: true, data: lowStock, meta: { total: lowStock.length } };
  if (p === '/coupons') return { success: true, data: [{ _id: 'cp1', code: 'SAVE10', isActive: true }, { _id: 'cp2', code: 'WELCOME', isActive: true }] };
  if (p === '/purchases/summary') return { success: true, data: { monthSpendCents: 1248000, totalSpendCents: 4210000, totalPurchases: 18, totalUnits: 96 } };
  if (p === '/analytics/revenue') return { success: true, data: { windowDays: 30, bucket: '4-day periods', totalRevenueCents: 6590000, deliveredOrders: 77, avgOrderValueCents: 85584, series: series.map(([period, revenueCents, count]) => ({ period, revenueCents, orders: count })) } };
  if (p === '/analytics/top-skus') return { success: true, data: { skus: [
    { sku: 'REF-FD-SS', productName: 'OptiHome French Door Refrigerator', units: 21, revenueCents: 3987900 },
    { sku: 'DSH-QC-SS', productName: 'QuietClean Dishwasher', units: 18, revenueCents: 1528200 },
    { sku: 'OVN-CV-BK', productName: 'Precision Convection Oven', units: 9, revenueCents: 1079100 }
  ] } };
  if (p === '/analytics/order-volume') return { success: true, data: { totalOrders: 94, series: series.map(([period,, count]) => ({ period, orders: count })) } };
  if (p === '/analytics/customer-growth') return { success: true, data: { totalCustomers: 312, newCustomers: 38, series: series.map(([period,, count], i) => ({ period, customers: Math.max(2, count - (i % 3)) })) } };
  if (p === '/analytics/purchase-spend') return { success: true, data: { totalSpendCents: 4210000, totalPurchases: 18, totalUnits: 96, series: series.map(([period,, count], i) => ({ period, spendCents: (i + 2) * 90000, purchases: Math.max(1, Math.round(count / 4)), units: count * 2 })) } };
  if (p === '/purchases') return { success: true, data: [], meta: { total: 0, pages: 1 } };
  return { success: true, data: [] };
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4173');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const body = JSON.stringify(responseFor(req.method, req.url));
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
});

server.listen(PORT, '127.0.0.1', () => console.log(`Presentation mock API listening on http://127.0.0.1:${PORT}`));

