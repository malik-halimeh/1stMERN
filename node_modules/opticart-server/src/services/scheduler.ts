/**
 * Recommendation Engine — Daily scheduled job (node-cron)
 *
 * Two jobs run each day at 02:00 server time:
 *  A) Co-occurrence engine: reads productEvents where eventType='purchase',
 *     groups by userId, builds product-pair co-occurrence weighted by
 *     recency decay 1/(daysSince+1), sums weights per pair, writes top-10
 *     per product into productRecommendations (upsert).
 *
 *  B) Trending/MostSelling flag updater: aggregates order volume and
 *     productEvent 'view' velocity over a trailing 7-day window,
 *     sets isTrending/isMostSelling flags accordingly.
 *
 * NOTE: Recommendations are NEVER computed synchronously on product-page
 * load — the GET /api/product-recommendations endpoint only reads from the
 * productRecommendations cache written here.
 */

import cron from 'node-cron';
import mongoose from 'mongoose';
import ProductEvent from '../models/ProductEvent.js';
import ProductRecommendation from '../models/ProductRecommendation.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

const TOP_N = 10; // top recommendations to store per product

// ─── A. Co-occurrence recommendation engine ──────────────────────────────────

export const runRecommendationEngine = async (): Promise<void> => {
  console.log('[RecommendationEngine] Starting co-occurrence computation...');

  try {
    const now = new Date();

    // 1. Pull all purchase events
    const purchaseEvents = await ProductEvent.find({ eventType: 'purchase' })
      .select('userId productId timestamp')
      .lean();

    if (purchaseEvents.length === 0) {
      console.log('[RecommendationEngine] No purchase events found — skipping.');
      return;
    }

    // 2. Group productIds per userId
    const userPurchases = new Map<string, { productId: string; daysSince: number }[]>();

    for (const event of purchaseEvents) {
      if (!event.userId) continue;
      const uid = event.userId.toString();
      const daysSince = (now.getTime() - new Date(event.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      if (!userPurchases.has(uid)) userPurchases.set(uid, []);
      userPurchases.get(uid)!.push({ productId: event.productId.toString(), daysSince });
    }

    // 3. Build co-occurrence weight map: pairKey -> totalWeight
    // pairKey = sorted(productA, productB).join('|')
    const pairWeights = new Map<string, number>();

    for (const purchases of userPurchases.values()) {
      // Deduplicate products per user, keep best (most recent) weight
      const productWeightMap = new Map<string, number>();
      for (const { productId, daysSince } of purchases) {
        const weight = 1 / (daysSince + 1);
        const existing = productWeightMap.get(productId) || 0;
        if (weight > existing) productWeightMap.set(productId, weight);
      }

      const productList = [...productWeightMap.entries()];
      // Form all pairs
      for (let i = 0; i < productList.length; i++) {
        for (let j = i + 1; j < productList.length; j++) {
          const [idA, wA] = productList[i];
          const [idB, wB] = productList[j];
          const pairWeight = wA + wB;
          const key = [idA, idB].sort().join('|');
          pairWeights.set(key, (pairWeights.get(key) || 0) + pairWeight);
        }
      }
    }

    if (pairWeights.size === 0) {
      console.log('[RecommendationEngine] No co-occurrence pairs found.');
      return;
    }

    // 4. Build per-product neighbour map: productId -> [{otherId, weight}]
    const productNeighbours = new Map<string, { id: string; weight: number }[]>();

    for (const [key, weight] of pairWeights.entries()) {
      const [idA, idB] = key.split('|');
      if (!productNeighbours.has(idA)) productNeighbours.set(idA, []);
      if (!productNeighbours.has(idB)) productNeighbours.set(idB, []);
      productNeighbours.get(idA)!.push({ id: idB, weight });
      productNeighbours.get(idB)!.push({ id: idA, weight });
    }

    // 5. Sort and take top-N, upsert into productRecommendations
    let upserted = 0;
    for (const [productId, neighbours] of productNeighbours.entries()) {
      const topN = neighbours
        .sort((a, b) => b.weight - a.weight)
        .slice(0, TOP_N)
        .map((n) => new mongoose.Types.ObjectId(n.id));

      await ProductRecommendation.findOneAndUpdate(
        { productId: new mongoose.Types.ObjectId(productId) },
        {
          productId: new mongoose.Types.ObjectId(productId),
          recommendedProductIds: topN,
          computedAt: now,
        },
        { upsert: true, new: true }
      );
      upserted++;
    }

    console.log(`[RecommendationEngine] Done. Upserted ${upserted} recommendation entries.`);
  } catch (err: any) {
    console.error('[RecommendationEngine] Error during computation:', err.message);
  }
};

// ─── B. Trending / MostSelling flag updater ──────────────────────────────────

export const runTrendingFlagUpdater = async (): Promise<void> => {
  console.log('[TrendingUpdater] Recalculating isTrending / isMostSelling flags...');

  try {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // --- isMostSelling: rank by order quantity sold in trailing 7d ---
    const orderAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: since7d }, status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', totalSold: { $sum: '$items.quantity' } } },
      { $sort: { totalSold: -1 } },
      { $limit: 8 },
    ]);

    const mostSellingIds = new Set(orderAgg.map((r: any) => r._id.toString()));

    // --- isTrending: rank by view event count in trailing 7d ---
    const viewAgg = await ProductEvent.aggregate([
      { $match: { eventType: 'view', timestamp: { $gte: since7d } } },
      { $group: { _id: '$productId', viewCount: { $sum: 1 } } },
      { $sort: { viewCount: -1 } },
      { $limit: 8 },
    ]);

    const trendingIds = new Set(viewAgg.map((r: any) => r._id.toString()));

    // Reset all flags then set new ones
    await Product.updateMany({}, { isTrending: false, isMostSelling: false });

    if (mostSellingIds.size > 0) {
      await Product.updateMany(
        { _id: { $in: [...mostSellingIds].map((id) => new mongoose.Types.ObjectId(id)) } },
        { isMostSelling: true }
      );
    }

    if (trendingIds.size > 0) {
      await Product.updateMany(
        { _id: { $in: [...trendingIds].map((id) => new mongoose.Types.ObjectId(id)) } },
        { isTrending: true }
      );
    }

    console.log(
      `[TrendingUpdater] Done. isMostSelling: ${mostSellingIds.size} products, isTrending: ${trendingIds.size} products.`
    );
  } catch (err: any) {
    console.error('[TrendingUpdater] Error during flag update:', err.message);
  }
};

// ─── Register cron jobs ───────────────────────────────────────────────────────

export const startScheduledJobs = (): void => {
  // Daily at 02:00 — co-occurrence recommendation engine
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Running daily recommendation computation...');
    await runRecommendationEngine();
    await runTrendingFlagUpdater();
  });

  console.log('[CRON] Scheduled jobs registered: recommendation engine + trending flags (daily @ 02:00).');
};
