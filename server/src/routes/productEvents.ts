import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import ProductEvent from '../models/ProductEvent.js';

const router = Router();

/**
 * POST /api/product-events/batch
 * Public endpoint — accepts an array of view events from the frontend buffer.
 * No auth required (views are anonymous-friendly). Validates each entry and
 * bulk-inserts into productEvents collection.
 */
router.post('/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(200).json({ success: true, inserted: 0 });
    }

    // Cap batch size at 50 to prevent abuse
    const batch = events.slice(0, 50);

    const docs = batch
      .filter(
        (e: any) =>
          e &&
          typeof e.productId === 'string' &&
          mongoose.Types.ObjectId.isValid(e.productId) &&
          ['view', 'cart_add', 'purchase'].includes(e.eventType)
      )
      .map((e: any) => ({
        userId: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : null,
        productId: new mongoose.Types.ObjectId(e.productId),
        eventType: e.eventType,
        timestamp: new Date(),
      }));

    if (docs.length > 0) {
      await ProductEvent.insertMany(docs, { ordered: false });
    }

    res.status(200).json({ success: true, inserted: docs.length });
  } catch (error: any) {
    // Duplicate key / partial failure should not crash the response
    console.error('[ProductEvents] Batch insert error:', error.message);
    res.status(200).json({ success: true, inserted: 0 });
  }
});

/**
 * GET /api/product-events/views?ids=id1,id2,...
 * Public, read-only. Returns the total number of 'view' events per product as
 * a { [productId]: count } map. This reads the SAME productEvents data the
 * recommendation/trending engine scores — it does not add or change any write
 * path. The storefront uses it to show a "views" count under each product.
 * Without ?ids, it returns the top viewed products (id -> count) for widgets.
 */
router.get('/views', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idsParam = (req.query.ids as string) || '';
    const match: Record<string, unknown> = { eventType: 'view' };

    if (idsParam.trim()) {
      const validIds = idsParam
        .split(',')
        .map((s) => s.trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      if (validIds.length === 0) {
        return res.status(200).json({ success: true, data: {} });
      }
      match.productId = { $in: validIds };
    }

    const rows = await ProductEvent.aggregate([
      { $match: match },
      { $group: { _id: '$productId', count: { $sum: 1 } } },
    ]);

    // Shape as a plain id -> count map for O(1) lookup on the client
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r._id.toString()] = r.count;

    res.status(200).json({ success: true, data: counts });
  } catch (error) {
    next(error);
  }
});

export default router;
