import { Router } from 'express';
import { getWishlist, addToWishlist, removeFromWishlist } from '../controllers/wishlist.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Wishlist routes are customer-scoped
router.use(authenticate, authorize('customer'));

router.get('/', getWishlist);
router.post('/:productId', addToWishlist);
router.delete('/:productId', removeFromWishlist);

export default router;
