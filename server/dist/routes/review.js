import { Router } from 'express';
import { getProductReviews, createReview, updateReview, deleteReview, } from '../controllers/review.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();
// Public route to inspect reviews of a product
router.get('/product/:productId', getProductReviews);
// Customer actions (submit/edit)
router.post('/', authenticate, authorize('customer'), createReview);
router.patch('/:id', authenticate, authorize('customer'), updateReview);
// Moderation action (remove review, writes auditLog entry)
router.delete('/:id', authenticate, authorize('inventory_manager', 'super_admin'), deleteReview);
export default router;
