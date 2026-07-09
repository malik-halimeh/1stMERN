import { Router } from 'express';
import {
  getRevenue,
  getTopSkus,
  getOrderVolume,
  getCustomerGrowth,
} from '../controllers/analytics.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Analytics aggregates are restricted exclusively to Super Admins
router.use(authenticate, authorize('super_admin'));

router.get('/revenue', getRevenue);
router.get('/top-skus', getTopSkus);
router.get('/order-volume', getOrderVolume);
router.get('/customer-growth', getCustomerGrowth);

export default router;
