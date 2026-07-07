import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import ProductRecommendation from '../models/ProductRecommendation.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/errors.js';

// GET /api/product-recommendations - Public
export const getProductRecommendations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.query;

    // 1. If seed productId is specified, lookup computed recommendations
    if (productId) {
      if (!mongoose.Types.ObjectId.isValid(productId as string)) {
        throw new AppError('VALIDATION_FAILED', 'Invalid seed product ID format.', 422);
      }

      const recommendationEntry = await ProductRecommendation.findOne({
        productId: new mongoose.Types.ObjectId(productId as string),
      }).populate('recommendedProductIds');

      if (recommendationEntry && recommendationEntry.recommendedProductIds.length > 0) {
        return res.status(200).json({
          success: true,
          data: recommendationEntry.recommendedProductIds,
        });
      }
    }

    // 2. Fallback: Return top isMostSelling products (or isTrending, or newest)
    let fallbackProducts = await Product.find({ isMostSelling: true }).limit(8);
    
    if (fallbackProducts.length === 0) {
      fallbackProducts = await Product.find({ isTrending: true }).limit(8);
    }
    
    if (fallbackProducts.length === 0) {
      fallbackProducts = await Product.find().sort({ createdAt: -1 }).limit(8);
    }

    res.status(200).json({
      success: true,
      data: fallbackProducts,
    });
  } catch (error) {
    next(error);
  }
};
