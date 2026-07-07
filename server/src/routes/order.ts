import { Router } from 'express';
import {
  createCheckoutSession,
  stripeWebhook,
  getOrderStatus,
  getOrders,
  getOrderDetails,
} from '../controllers/order.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Stripe calls webhook directly. Express router executes this publicly
router.post('/webhook', stripeWebhook);

// All other order actions are restricted to customer profiles
router.use(authenticate, authorize('customer'));

router.get('/', getOrders);
router.post('/checkout-session', createCheckoutSession);
router.get('/status/:paymentIntentId', getOrderStatus);
router.get('/:id', getOrderDetails);

export default router;
