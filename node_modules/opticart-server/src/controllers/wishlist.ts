import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/errors.js';

// 1. GET /api/wishlist - Customer Only
export const getWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    let wishlist = await Wishlist.findOne({ userId }).populate('productIds');

    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, productIds: [] });
    }

    res.status(200).json({
      success: true,
      data: wishlist,
    });
  } catch (error) {
    next(error);
  }
};

// 2. POST /api/wishlist/:productId - Add to Wishlist
export const addToWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }

    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid product ID format.', 422);
    }

    // Verify product exists
    const productExists = await Product.exists({ _id: productId });
    if (!productExists) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found.', 404);
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, productIds: [] });
    }

    const prodId = new mongoose.Types.ObjectId(productId);

    // Prevent duplicate entries
    if (!wishlist.productIds.some((id) => id.toString() === productId)) {
      wishlist.productIds.push(prodId);
      await wishlist.save();
    }

    res.status(200).json({
      success: true,
      data: wishlist,
    });
  } catch (error) {
    next(error);
  }
};

// 3. DELETE /api/wishlist/:productId - Remove from Wishlist
export const removeFromWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }

    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid product ID format.', 422);
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      throw new AppError('WISHLIST_NOT_FOUND', 'Wishlist not found.', 404);
    }

    const beforeLength = wishlist.productIds.length;
    wishlist.productIds = wishlist.productIds.filter((id) => id.toString() !== productId);

    if (wishlist.productIds.length === beforeLength) {
      throw new AppError('WISHLIST_ITEM_NOT_FOUND', 'Item not found in your wishlist.', 404);
    }

    await wishlist.save();

    res.status(200).json({
      success: true,
      data: wishlist,
    });
  } catch (error) {
    next(error);
  }
};

// 4. POST /api/wishlist/merge - Merge guest local wishlist into authenticated wishlist
export const mergeWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }

    const { productIds } = req.body;

    if (!Array.isArray(productIds)) {
      throw new AppError('VALIDATION_FAILED', 'productIds must be an array.', 422);
    }

    // Validate and filter to existing products only
    const validIds = productIds
      .filter((id: any) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id))
      .map((id: string) => new mongoose.Types.ObjectId(id));

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, productIds: [] });
    }

    // De-duplicate: only add IDs not already in the wishlist
    const existingSet = new Set(wishlist.productIds.map((id) => id.toString()));
    for (const id of validIds) {
      if (!existingSet.has(id.toString())) {
        wishlist.productIds.push(id);
        existingSet.add(id.toString());
      }
    }

    await wishlist.save();

    res.status(200).json({
      success: true,
      data: { merged: validIds.length },
    });
  } catch (error) {
    next(error);
  }
};
