import { Router } from 'express';
import {
  getRevenue,
  getTopSkus,
  getOrderVolume,
  getCustomerGrowth,
  getPurchaseSpend,
} from '../controllers/analytics.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Analytics aggregates are restricted exclusively to Super Admins
router.use(authenticate, authorize('super_admin'));

router.get('/revenue', getRevenue);
router.get('/top-skus', getTopSkus);
router.get('/order-volume', getOrderVolume);
router.get('/customer-growth', getCustomerGrowth);
router.get('/purchase-spend', getPurchaseSpend);

export default router;
