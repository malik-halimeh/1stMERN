import { Router } from 'express';
import { getWishlist, addToWishlist, removeFromWishlist, mergeWishlist } from '../controllers/wishlist.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// All wishlist routes require authentication as a customer
router.use(authenticate, authorize('customer'));

router.get('/', getWishlist);
router.post('/merge', mergeWishlist);        // Merge guest localStorage wishlist on login
router.post('/:productId', addToWishlist);
router.delete('/:productId', removeFromWishlist);

export default router;
