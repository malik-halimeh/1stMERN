import { Router } from 'express';
import { getCart, addToCart, updateCartItem, removeCartItem, mergeCart } from '../controllers/cart.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// All shopping cart routes require authentication. Staff roles (inventory
// manager / super admin) can shop exactly like customers.
router.use(authenticate, authorize('customer', 'inventory_manager', 'super_admin'));

router.get('/', getCart);
router.post('/items', addToCart);
router.patch('/items/:productId', updateCartItem);
router.delete('/items/:productId', removeCartItem);
router.post('/merge', mergeCart);

export default router;
