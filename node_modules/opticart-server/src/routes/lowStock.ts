import { Router } from 'express';
import { getLowStockAlerts, resolveLowStockAlert } from '../controllers/lowStock.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Super admins get read visibility; resolving stays manager-scoped
router.get('/', authorize('inventory_manager', 'super_admin'), getLowStockAlerts);
router.patch('/:id/resolve', authorize('inventory_manager'), resolveLowStockAlert);

export default router;
