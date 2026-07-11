import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { escapeRegex } from '../utils/escapeRegex.js';

// Helper to recalculate ratings/reviews count under transaction session
const recalculateProductRatings = async (
  productId: string | mongoose.Types.ObjectId,
  session?: mongoose.ClientSession
) => {
  // Get all active reviews that are not deleted/removed
  const query = Review.find({ productId, isRemoved: false });
  if (session) {
    query.session(session);
  }
  const reviews = await query;

  const reviewCount = reviews.length;
  let ratingAvg = 0;
  if (reviewCount > 0) {
    const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
    ratingAvg = parseFloat((sum / reviewCount).toFixed(2));
  }

  const updateQuery = Product.findByIdAndUpdate(productId, {
    ratingAvg,
    reviewCount,
  });

  if (session) {
    updateQuery.session(session);
  }

  await updateQuery;
};

// 1. GET /api/reviews/product/:productId - Public, Paginated
export const getProductReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid product ID format.', 422);
    }

    const filter = { productId, isRemoved: false };
    const total = await Review.countDocuments(filter);
    const reviews = await Review.find(filter)
      .populate('userId', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: reviews,
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

// 2. POST /api/reviews - Customer Only, Verified Purchase
export const createReview = async (req: Request, res: Response, next: NextFunction) => {
  const session = await mongoose.startSession();
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Session is not authenticated.', 401);
    }

    // NOTE: review photos are deliberately NOT accepted from the request body.
    // There is no upload pipeline for reviews (unlike products' Multer→
    // Cloudinary flow), so accepting raw client-supplied URLs would let anyone
    // store arbitrary external links that get rendered to other shoppers.
    const { productId, rating, text } = req.body;
    const numRating = parseInt(rating);

    if (!productId || isNaN(numRating) || !text) {
      throw new AppError('VALIDATION_FAILED', 'Product ID, valid numeric rating (1-5), and review text are required.', 422);
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid product ID format.', 422);
    }

    if (numRating < 1 || numRating > 5) {
      throw new AppError('VALIDATION_FAILED', 'Rating score must be between 1 and 5.', 422);
    }

    const requesterUserId = new mongoose.Types.ObjectId(req.user.userId);
    const targetProductId = new mongoose.Types.ObjectId(productId);

    // Verified purchase check: Look for a completed/delivered order containing the product
    const deliveredOrder = await Order.findOne({
      userId: requesterUserId,
      status: 'delivered',
      'items.productId': targetProductId,
    });

    if (!deliveredOrder) {
      throw new AppError(
        'REVIEW_VERIFIED_PURCHASE_REQUIRED',
        'Verified purchase is required. You can only review products that have been delivered to you.',
        403
      );
    }

    // Compound unique index verification: check if review already exists
    const duplicateReview = await Review.findOne({
      userId: requesterUserId,
      productId: targetProductId,
    });

    if (duplicateReview) {
      throw new AppError('REVIEW_ALREADY_EXISTS', 'You have already submitted a review for this product.', 409);
    }

    let review;
    // Attempt Mongoose Transaction Session
    try {
      session.startTransaction();

      review = await Review.create(
        [
          {
            productId: targetProductId,
            userId: requesterUserId,
            orderId: deliveredOrder._id,
            rating: numRating,
            text,
            images: [],
            isFlagged: false,
            isRemoved: false,
            createdAt: new Date(),
          },
        ],
        { session }
      );

      // Denormalized update under transaction
      await recalculateProductRatings(targetProductId, session);
      await session.commitTransaction();
    } catch (txErr: any) {
      await session.abortTransaction();
      // Standalone MongoDB server compatibility fallback:
      if (/transaction/i.test(txErr.message) || txErr.codeName === 'CommandNotSupportedOnReplicaSetMemberWithoutReplication') {
        console.warn('Transactions are disabled by DB host. Executing queries sequentially...');
        
        // Retry standard sequential execution
        review = await Review.create({
          productId: targetProductId,
          userId: requesterUserId,
          orderId: deliveredOrder._id,
          rating: numRating,
          text,
          images: [],
          isFlagged: false,
          isRemoved: false,
          createdAt: new Date(),
        });
        await recalculateProductRatings(targetProductId);
      } else {
        throw txErr;
      }
    }

    res.status(201).json({
      success: true,
      data: Array.isArray(review) ? review[0] : review,
    });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};

// 3. PATCH /api/reviews/:id - Customer Owner Only, max 30 days
export const updateReview = async (req: Request, res: Response, next: NextFunction) => {
  const session = await mongoose.startSession();
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Session is not authenticated.', 401);
    }

    const { id } = req.params;
    // images deliberately not accepted — see createReview note
    const { rating, text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid review ID format.', 422);
    }

    const review = await Review.findById(id);
    if (!review) {
      throw new AppError('REVIEW_NOT_FOUND', 'Review not found.', 404);
    }

    // Owner check
    if (review.userId.toString() !== req.user.userId) {
      throw new AppError('AUTH_FORBIDDEN', 'Access denied. You do not own this review.', 403);
    }

    // 30 Days Check
    const diffTime = Math.abs(new Date().getTime() - new Date(review.createdAt).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 30) {
      throw new AppError('REVIEW_EDIT_EXPIRED', 'Reviews cannot be edited after 30 days of submission.', 403);
    }

    if (rating !== undefined) {
      const numRating = parseInt(rating);
      if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        throw new AppError('VALIDATION_FAILED', 'Rating score must be between 1 and 5.', 422);
      }
      review.rating = numRating;
    }

    if (text) review.text = text;
    review.editedAt = new Date();

    try {
      session.startTransaction();
      await review.save({ session });
      await recalculateProductRatings(review.productId, session);
      await session.commitTransaction();
    } catch (txErr: any) {
      await session.abortTransaction();
      if (/transaction/i.test(txErr.message) || txErr.codeName === 'CommandNotSupportedOnReplicaSetMemberWithoutReplication') {
        console.warn('Transactions disabled. Executing standard queries...');
        await review.save();
        await recalculateProductRatings(review.productId);
      } else {
        throw txErr;
      }
    }

    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};

// 4. DELETE /api/reviews/:id - Manager/Super Admin Moderation Only
export const deleteReview = async (req: Request, res: Response, next: NextFunction) => {
  const session = await mongoose.startSession();
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Session is not authenticated.', 401);
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid review ID format.', 422);
    }

    const review = await Review.findById(id);
    if (!review) {
      throw new AppError('REVIEW_NOT_FOUND', 'Review not found.', 404);
    }

    const beforeData = JSON.parse(JSON.stringify(review.toObject()));

    // Soft review removal flag: isRemoved: true
    review.isRemoved = true;

    try {
      session.startTransaction();
      await review.save({ session });
      // Recalculate denormalized fields
      await recalculateProductRatings(review.productId, session);
      await session.commitTransaction();
    } catch (txErr: any) {
      await session.abortTransaction();
      if (/transaction/i.test(txErr.message) || txErr.codeName === 'CommandNotSupportedOnReplicaSetMemberWithoutReplication') {
        console.warn('Transactions disabled. Running sequential soft deletes...');
        await review.save();
        await recalculateProductRatings(review.productId);
      } else {
        throw txErr;
      }
    }

    // Write Audit Log
    const actor = await User.findById(req.user.userId);
    await AuditLog.create({
      actorId: new mongoose.Types.ObjectId(req.user.userId),
      actorName: actor?.name || 'Moderator',
      actionType: 'review_removal',
      targetEntityType: 'Review',
      targetEntityId: review._id,
      changeDelta: {
        before: beforeData,
        after: review.toObject(),
      },
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Review moderated and removed successfully.',
      },
    });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};

// GET /api/reviews - Full review list for staff moderation (paginated)
export const getAllReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { isRemoved: false };

    // Search review text (partial, case-insensitive)
    const q = req.query.q as string | undefined;
    if (q?.trim()) {
      filter.text = { $regex: escapeRegex(q), $options: 'i' };
    }

    const total = await Review.countDocuments(filter);
    const reviews = await Review.find(filter)
      .populate('productId', 'name slug')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: reviews,
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
