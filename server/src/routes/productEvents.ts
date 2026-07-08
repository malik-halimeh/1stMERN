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

export default router;
