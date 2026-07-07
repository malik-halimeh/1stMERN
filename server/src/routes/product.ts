import { Router } from 'express';
import multer from 'multer';
import {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Multer memory storage setup to hold file buffers for Cloudinary streams
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB image limit
});

// Public endpoints
router.get('/', getProducts);
router.get('/:slug', getProductBySlug);

// Manager endpoints
router.post(
  '/',
  authenticate,
  authorize('inventory_manager'),
  upload.array('images', 5) as any, // Accept up to 5 uploaded images
  createProduct
);

router.patch('/:id', authenticate, authorize('inventory_manager'), updateProduct);
router.delete('/:id', authenticate, authorize('inventory_manager'), deleteProduct);

export default router;
