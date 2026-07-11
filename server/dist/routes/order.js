import { Router } from 'express';
import { createCheckoutSession, stripeWebhook, getOrderStatus, getOrders, getOrderDetails, updateOrderStatus, submitOrderFeedback, } from '../controllers/order.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();
// Stripe calls webhook directly — public, no auth
router.post('/webhook', stripeWebhook);
// Customer-scoped order routes
router.use(authenticate);
// Customers see their own orders; managers and super admins see all orders
router.get('/', authorize('customer', 'inventory_manager', 'super_admin'), getOrders);
router.post('/checkout-session', authorize('customer', 'inventory_manager', 'super_admin'), createCheckoutSession);
router.get('/status/:paymentIntentId', authorize('customer', 'inventory_manager', 'super_admin'), getOrderStatus);
router.get('/:id', authorize('customer', 'inventory_manager', 'super_admin'), getOrderDetails);
// Order owner leaves feedback after staff confirmation
router.post('/:id/feedback', authorize('customer', 'inventory_manager', 'super_admin'), submitOrderFeedback);
// Inventory manager: advance order status
router.patch('/:id/status', authorize('inventory_manager', 'super_admin'), updateOrderStatus);
export default router;
