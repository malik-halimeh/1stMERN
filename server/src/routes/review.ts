import { Router } from 'express';
import {
  getProductReviews,
  getAllReviews,
  createReview,
  updateReview,
  deleteReview,
} from '../controllers/review.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Public route to inspect reviews of a product
router.get('/product/:productId', getProductReviews);

// Staff moderation list of all reviews
router.get('/', authenticate, authorize('inventory_manager', 'super_admin'), getAllReviews);

// Shopper actions (submit/edit) — staff can shop and review like customers
router.post('/', authenticate, authorize('customer', 'inventory_manager', 'super_admin'), createReview);
router.patch('/:id', authenticate, authorize('customer', 'inventory_manager', 'super_admin'), updateReview);

// Moderation action (remove review, writes auditLog entry)
router.delete('/:id', authenticate, authorize('inventory_manager', 'super_admin'), deleteReview);

export default router;
