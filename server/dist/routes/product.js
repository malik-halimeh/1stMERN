import { Router } from 'express';
import multer from 'multer';
import { getProducts, getProductBySlug, getProductsByIds, createProduct, updateProduct, deleteProduct, } from '../controllers/product.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = Router();
// Multer memory storage setup to hold file buffers for Cloudinary streams
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB image limit
});
// Gallery images + one optional photo per variant. Multer passes JSON
// requests through untouched, so the PATCH route still accepts plain JSON.
const productUpload = upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'variantImages', maxCount: 20 },
]);
// Public endpoints
router.get('/', getProducts);
router.get('/by-ids', getProductsByIds); // Batch fetch by ObjectId array — public, no auth
router.get('/:slug', getProductBySlug);
// Manager endpoints
router.post('/', authenticate, authorize('inventory_manager', 'super_admin'), productUpload, createProduct);
router.patch('/:id', authenticate, authorize('inventory_manager', 'super_admin'), productUpload, updateProduct);
router.delete('/:id', authenticate, authorize('inventory_manager', 'super_admin'), deleteProduct);
export default router;
