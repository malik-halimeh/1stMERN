import { Router } from 'express';
import { getLowStockAlerts, resolveLowStockAlert } from '../controllers/lowStock.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();
// Low stock routing is inventory-manager scoped
router.use(authenticate, authorize('inventory_manager'));
router.get('/', getLowStockAlerts);
router.patch('/:id/resolve', resolveLowStockAlert);
export default router;
