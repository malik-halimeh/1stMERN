import { Router } from 'express';
import { getWishlist, addToWishlist, removeFromWishlist, mergeWishlist } from '../controllers/wishlist.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();
// All wishlist routes require authentication. Staff roles (inventory
// manager / super admin) can use the wishlist exactly like customers.
router.use(authenticate, authorize('customer', 'inventory_manager', 'super_admin'));
router.get('/', getWishlist);
router.post('/merge', mergeWishlist); // Merge guest localStorage wishlist on login
router.post('/:productId', addToWishlist);
router.delete('/:productId', removeFromWishlist);
export default router;
