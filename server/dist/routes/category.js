import { Router } from 'express';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();
// Public route to retrieve categories
router.get('/', getCategories);
// Elevated routes for staff CUD operations (managers and super admins)
router.post('/', authenticate, authorize('inventory_manager', 'super_admin'), createCategory);
router.patch('/:id', authenticate, authorize('inventory_manager', 'super_admin'), updateCategory);
router.delete('/:id', authenticate, authorize('inventory_manager', 'super_admin'), deleteCategory);
export default router;
