import { Router } from 'express';
import { getCart, addToCart, updateCartItem, removeCartItem, mergeCart } from '../controllers/cart.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();
// All shopping cart routes require authentication and are restricted to customer profiles
router.use(authenticate, authorize('customer'));
router.get('/', getCart);
router.post('/items', addToCart);
router.patch('/items/:productId', updateCartItem);
router.delete('/items/:productId', removeCartItem);
router.post('/merge', mergeCart);
export default router;
