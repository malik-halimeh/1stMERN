import { Router } from 'express';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Public route to retrieve categories
router.get('/', getCategories);

// Elevated routes for inventory manager CUD operations
router.post('/', authenticate, authorize('inventory_manager'), createCategory);
router.patch('/:id', authenticate, authorize('inventory_manager'), updateCategory);
router.delete('/:id', authenticate, authorize('inventory_manager'), deleteCategory);

export default router;
