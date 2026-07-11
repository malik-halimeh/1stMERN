import { Router } from 'express';
import { getLowStockAlerts, resolveLowStockAlert } from '../controllers/lowStock.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();
router.use(authenticate);
// Inventory managers and super admins have equal access
router.get('/', authorize('inventory_manager', 'super_admin'), getLowStockAlerts);
router.patch('/:id/resolve', authorize('inventory_manager', 'super_admin'), resolveLowStockAlert);
export default router;
