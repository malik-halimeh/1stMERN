import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import Product from '../models/Product.js';
import AuditLog from '../models/AuditLog.js';
import LowStockAlert from '../models/LowStockAlert.js';
import User from '../models/User.js';
import { AppError } from '../utils/errors.js';

// Helper to trigger stock alerts gracefully
const checkAndTriggerLowStock = async (
  productId: mongoose.Types.ObjectId,
  variantSku: string,
  currentStock: number,
  threshold: number
) => {
  if (currentStock <= threshold) {
    try {
      await LowStockAlert.create({
        productId,
        variantSku,
        thresholdAtTrigger: threshold,
        currentStock,
        status: 'active',
        createdAt: new Date(),
      });
      console.log(`✓ Low stock alert created for Product: ${productId}, Variant SKU: ${variantSku}`);
    } catch (error: any) {
      if (error.code === 11000) {
        // Enforced by compound index: one active alert per variant. Suppress duplicate-key errors.
        console.log(`Active low stock alert already exists for ${productId} (${variantSku}).`);
      } else {
        console.error('Error triggering low stock alert:', error.message);
      }
    }
  }
};

// Weighted-average cost: if there is no meaningful prior basis (empty stock or
// zero/missing cost), the purchase cost becomes the new cost outright.
const weightedAvgCost = (oldStock: number, oldCostCents: number, qty: number, unitCostCents: number): number => {
  if (oldStock <= 0 || !oldCostCents || oldCostCents <= 0) return unitCostCents;
  return Math.round((oldStock * oldCostCents + qty * unitCostCents) / (oldStock + qty));
};

// 1. POST /api/purchases - Staff Only
export const createPurchase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Session is not authenticated.', 401);
    }

    const { productId, variantSku, quantity, unitCostCents, note } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError('VALIDATION_FAILED', 'A valid product ID is required.', 422);
    }
    if (!variantSku || typeof variantSku !== 'string') {
      throw new AppError('VALIDATION_FAILED', 'A variant SKU is required.', 422);
    }

    const qty = parseInt(quantity);
    const unitCost = parseInt(unitCostCents);

    if (isNaN(qty) || qty < 1) {
      throw new AppError('VALIDATION_FAILED', 'Quantity must be a whole number of at least 1.', 422);
    }
    if (isNaN(unitCost) || unitCost < 0) {
      throw new AppError('VALIDATION_FAILED', 'Unit cost must be a non-negative amount in cents.', 422);
    }
    if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) {
      throw new AppError('VALIDATION_FAILED', 'Note must be a string of at most 500 characters.', 422);
    }

    const sku = variantSku.trim();

    // Single atomic pipeline update: adds stock AND recomputes the weighted-average
    // cost in one document operation, so there is no read-then-write race with
    // concurrent sales/purchases. (The positional `$` operator can't compute an
    // average, hence the $map rewrite of the variants array.)
    // { new: false } returns the PRE-update doc so we can audit before/after
    // without a second read.
    const preUpdate = await Product.findOneAndUpdate(
      { _id: productId, 'variants.sku': sku },
      [
        {
          $set: {
            variants: {
              $map: {
                input: '$variants',
                as: 'v',
                in: {
                  $cond: [
                    { $eq: ['$$v.sku', sku] },
                    {
                      $mergeObjects: [
                        '$$v',
                        {
                          stock: { $add: ['$$v.stock', qty] },
                          costPriceCents: {
                            $cond: [
                              {
                                $or: [
                                  { $lte: ['$$v.stock', 0] },
                                  { $lte: [{ $ifNull: ['$$v.costPriceCents', 0] }, 0] },
                                ],
                              },
                              unitCost,
                              {
                                $round: [
                                  {
                                    $divide: [
                                      {
                                        $add: [
                                          { $multiply: ['$$v.stock', '$$v.costPriceCents'] },
                                          qty * unitCost,
                                        ],
                                      },
                                      { $add: ['$$v.stock', qty] },
                                    ],
                                  },
                                  0,
                                ],
                              },
                            ],
                          },
                        },
                      ],
                    },
                    '$$v',
                  ],
                },
              },
            },
          },
        },
      ],
      { new: false }
    );

    if (!preUpdate) {
      throw new AppError('PURCHASE_TARGET_NOT_FOUND', 'Product or variant SKU not found.', 404);
    }

    const oldVariant = preUpdate.variants.find((v) => v.sku === sku)!;
    const oldStock = oldVariant.stock;
    const oldCost = oldVariant.costPriceCents;
    const newStock = oldStock + qty;
    const newCost = weightedAvgCost(oldStock, oldCost, qty, unitCost);

    const actor = await User.findById(req.user.userId);

    let purchase;
    try {
      purchase = await Purchase.create({
        productId: preUpdate._id,
        productName: preUpdate.name,
        variantSku: sku,
        quantity: qty,
        unitCostCents: unitCost,
        totalCostCents: qty * unitCost,
        note: note ? String(note).trim() : undefined,
        createdBy: new mongoose.Types.ObjectId(req.user.userId),
        createdByName: actor?.name || 'Staff',
      });
    } catch (createError) {
      // Compensate: the stock/cost update already landed, so revert it before
      // surfacing the error. (Tiny non-transactional window, consistent with
      // how the rest of the codebase handles single-document stock updates.)
      try {
        await Product.updateOne(
          { _id: productId, 'variants.sku': sku },
          { $inc: { 'variants.$.stock': -qty }, $set: { 'variants.$.costPriceCents': oldCost } }
        );
      } catch (revertError: any) {
        console.error('Failed to revert stock after purchase creation error:', revertError.message);
      }
      throw createError;
    }

    await AuditLog.create({
      actorId: new mongoose.Types.ObjectId(req.user.userId),
      actorName: actor?.name || 'Staff',
      actionType: 'stock_purchase',
      targetEntityType: 'Purchase',
      targetEntityId: purchase._id,
      changeDelta: {
        before: { sku, stock: oldStock, costPriceCents: oldCost },
        after: { sku, stock: newStock, costPriceCents: newCost, quantity: qty, unitCostCents: unitCost },
      },
    });

    res.status(201).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    next(error);
  }
};

// 2. GET /api/purchases - Staff Only (paginated list)
export const getPurchases = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const total = await Purchase.countDocuments();
    const purchases = await Purchase.find().skip(skip).limit(limit).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: purchases,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 3. GET /api/purchases/summary - Staff Only (month-to-date KPI for the dashboard tile)
export const getPurchaseSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [row] = await Purchase.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
      {
        $group: {
          _id: null,
          spendCents: { $sum: '$totalCostCents' },
          purchases: { $sum: 1 },
          units: { $sum: '$quantity' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        monthSpendCents: row?.spendCents ?? 0,
        monthPurchases: row?.purchases ?? 0,
        monthUnits: row?.units ?? 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 4. DELETE /api/purchases/:id - Staff Only (reverts stock; cost price is NOT reverted)
export const deletePurchase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Session is not authenticated.', 401);
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid purchase ID format.', 422);
    }

    const purchase = await Purchase.findById(id);
    if (!purchase) {
      throw new AppError('PURCHASE_NOT_FOUND', 'Purchase not found.', 404);
    }

    // Guarded revert: stock >= quantity is part of the match, so concurrent
    // sales can't drive the variant negative (same pattern as the order
    // webhook's stock decrement).
    const reverted = await Product.findOneAndUpdate(
      {
        _id: purchase.productId,
        variants: { $elemMatch: { sku: purchase.variantSku, stock: { $gte: purchase.quantity } } },
      },
      { $inc: { 'variants.$.stock': -purchase.quantity } },
      { new: true }
    );

    if (!reverted) {
      // Distinguish "insufficient stock" (reject) from "product/variant gone" (nothing to revert)
      const stillExists = await Product.exists({ _id: purchase.productId, 'variants.sku': purchase.variantSku });
      if (stillExists) {
        throw new AppError(
          'PURCHASE_REVERT_INSUFFICIENT_STOCK',
          `Cannot delete: current stock of ${purchase.variantSku} is lower than the purchase quantity (${purchase.quantity}), so stock would go negative.`,
          409
        );
      }
    }

    if (reverted) {
      const variant = reverted.variants.find((v) => v.sku === purchase.variantSku);
      if (variant) {
        await checkAndTriggerLowStock(
          reverted._id as mongoose.Types.ObjectId,
          variant.sku,
          variant.stock,
          variant.lowStockThreshold
        );
      }
    }

    const beforeData = JSON.parse(JSON.stringify(purchase.toObject()));
    await Purchase.deleteOne({ _id: id });

    const actor = await User.findById(req.user.userId);
    await AuditLog.create({
      actorId: new mongoose.Types.ObjectId(req.user.userId),
      actorName: actor?.name || 'Staff',
      actionType: 'stock_purchase',
      targetEntityType: 'Purchase',
      targetEntityId: new mongoose.Types.ObjectId(id),
      changeDelta: {
        before: beforeData,
        after: null,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Purchase deleted and stock reverted.',
      },
    });
  } catch (error) {
    next(error);
  }
};
