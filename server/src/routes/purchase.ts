import { Router } from 'express';
import { createPurchase, getPurchases, getPurchaseSummary, deletePurchase } from '../controllers/purchase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Staff endpoints (inventory managers and super admins have equal access)
router.use(authenticate, authorize('inventory_manager', 'super_admin'));

router.get('/summary', getPurchaseSummary);
router.get('/', getPurchases);
router.post('/', createPurchase);
router.delete('/:id', deletePurchase);

export default router;
