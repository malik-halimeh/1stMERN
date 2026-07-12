import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import AuditLog from '../models/AuditLog.js';
import LowStockAlert from '../models/LowStockAlert.js';
import User from '../models/User.js';
import { uploadImageBuffer } from '../config/cloudinary.js';
import { AppError } from '../utils/errors.js';
// Accepts image URLs pasted into the admin form — a JSON array string, a
// comma/newline-separated string, or an array — and returns clean http(s) URLs.
// URL images carry publicId 'external' so we never try to delete them from Cloudinary.
const parseImageUrls = (raw) => {
    if (!raw)
        return [];
    let list = [];
    if (Array.isArray(raw)) {
        list = raw;
    }
    else if (typeof raw === 'string' && raw.trim()) {
        const s = raw.trim();
        if (s.startsWith('[')) {
            try {
                list = JSON.parse(s);
            }
            catch {
                list = [];
            }
        }
        else {
            list = s.split(/[\n,]+/);
        }
    }
    return list
        .map((u) => String(u).trim())
        .filter((u) => /^https?:\/\//i.test(u))
        .slice(0, 5)
        .map((url) => ({ url, publicId: 'external' }));
};
// Helper to trigger stock alerts gracefully
const checkAndTriggerLowStock = async (productId, variantSku, currentStock, threshold) => {
    if (currentStock <= threshold) {
        try {
            await LowStockAlert.create({
                productId,
                variantSku,
                thresholdAtTrigger: threshold,
                currentStock,
                status: 'active',
                createdAt: new Date(),
            });
            console.log(`✓ Low stock alert created for Product: ${productId}, Variant SKU: ${variantSku}`);
        }
        catch (error) {
            if (error.code === 11000) {
                // Enforced by compound index: one active alert per variant. Suppress duplicate-key errors.
                console.log(`Active low stock alert already exists for ${productId} (${variantSku}).`);
            }
            else {
                console.error('Error triggering low stock alert:', error.message);
            }
        }
    }
};
// 1. GET /api/products - Public listing w/ queries
export const getProducts = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const { category, minPrice, maxPrice, rating, sort, search, inStock } = req.query;
        const filter = {};
        // Storefront passes inStock=1 so sold-out products (every variant at 0)
        // never show in the shop; the admin catalog omits it and sees everything
        if (inStock === '1' || inStock === 'true') {
            filter.variants = { $elemMatch: { stock: { $gt: 0 } } };
        }
        // Category Filter
        if (category) {
            let catId = null;
            if (mongoose.Types.ObjectId.isValid(category)) {
                catId = new mongoose.Types.ObjectId(category);
            }
            else {
                const catDoc = await Category.findOne({ slug: category });
                if (catDoc)
                    catId = catDoc._id;
            }
            if (catId) {
                // Match categoryId or any subcategory child referencing it
                const childCats = await Category.find({ parentId: catId });
                const catIds = [catId, ...childCats.map((c) => c._id)];
                filter.categoryId = { $in: catIds };
            }
            else {
                // Category slug did not match, return empty results early
                return res.status(200).json({
                    success: true,
                    data: [],
                    meta: { total: 0, page, limit, pages: 0 },
                });
            }
        }
        // Price Filter (Query in dollars, DB stores cents)
        if (minPrice || maxPrice) {
            filter.basePriceCents = {};
            if (minPrice) {
                filter.basePriceCents.$gte = Math.round(parseFloat(minPrice) * 100);
            }
            if (maxPrice) {
                filter.basePriceCents.$lte = Math.round(parseFloat(maxPrice) * 100);
            }
        }
        // Average Rating Filter
        if (rating) {
            filter.ratingAvg = { $gte: parseFloat(rating) };
        }
        // Full-Text Search index
        let sortOption = { createdAt: -1 };
        if (search) {
            filter.$text = { $search: String(search) };
            sortOption = { score: { $meta: 'textScore' } };
        }
        // Sorting overrides
        if (sort) {
            if (sort === 'price_asc')
                sortOption = { basePriceCents: 1 };
            else if (sort === 'price_desc')
                sortOption = { basePriceCents: -1 };
            else if (sort === 'rating_desc')
                sortOption = { ratingAvg: -1 };
            else if (sort === 'newest')
                sortOption = { createdAt: -1 };
        }
        const total = await Product.countDocuments(filter);
        // Perform search matching
        const products = await Product.find(filter)
            .sort(sortOption)
            .skip(skip)
            .limit(limit);
        res.status(200).json({
            success: true,
            data: products,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
// 2. GET /api/products/:slug - Public single product
export const getProductBySlug = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const product = await Product.findOne({ slug }).populate('reviews');
        if (!product) {
            throw new AppError('PRODUCT_NOT_FOUND', 'Product not found.', 404);
        }
        res.status(200).json({
            success: true,
            data: product,
        });
    }
    catch (error) {
        next(error);
    }
};
// 3. GET /api/products/by-ids?ids=id1,id2 — Public batch fetch (used by guest wishlist)
export const getProductsByIds = async (req, res, next) => {
    try {
        const idsParam = req.query.ids;
        if (!idsParam || !idsParam.trim()) {
            return res.status(200).json({ success: true, data: [] });
        }
        const rawIds = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
        // Filter to only valid ObjectIds to avoid DB errors
        const validIds = rawIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
        if (validIds.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }
        const products = await Product.find({ _id: { $in: validIds } }).select('name slug brand basePriceCents variants images ratingAvg reviewCount thumbnail isTrending isMostSelling');
        res.status(200).json({ success: true, data: products });
    }
    catch (error) {
        next(error);
    }
};
// Upload variant image files and attach each to its variant: a variant whose
// JSON carries `imageSlot: n` receives the n-th `variantImages` file. Variants
// keeping an existing `image` object simply pass it through untouched.
const attachVariantImages = async (parsedVariants, variantImageFiles) => {
    const uploads = [];
    for (const file of variantImageFiles) {
        uploads.push(await uploadImageBuffer(file.buffer));
    }
    for (const v of parsedVariants) {
        if (typeof v.imageSlot === 'number' && uploads[v.imageSlot]) {
            v.image = uploads[v.imageSlot];
        }
        delete v.imageSlot;
    }
};
// 4. POST /api/products - Manager Only (Multipart Cloudinary Upload)
export const createProduct = async (req, res, next) => {
    try {
        // Form data fields might contain stringified JSON arrays
        let { name, description, brand, categoryId, basePriceCents, variants, searchKeywords, meta } = req.body;
        if (!name || !description || !categoryId || !basePriceCents) {
            throw new AppError('VALIDATION_FAILED', 'Missing required product parameters.', 422);
        }
        // Validate categoryId
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            throw new AppError('VALIDATION_FAILED', 'Invalid categoryId format.', 422);
        }
        const cat = await Category.findById(categoryId);
        if (!cat) {
            throw new AppError('CATEGORY_NOT_FOUND', 'Category does not exist.', 404);
        }
        // Parse stringified variants and keywords from multipart form data
        let parsedVariants = [];
        if (typeof variants === 'string') {
            try {
                parsedVariants = JSON.parse(variants);
            }
            catch (err) {
                throw new AppError('VALIDATION_FAILED', 'Variants field must be a valid JSON array string.', 422);
            }
        }
        else if (Array.isArray(variants)) {
            parsedVariants = variants;
        }
        let parsedKeywords = [];
        if (typeof searchKeywords === 'string') {
            try {
                parsedKeywords = JSON.parse(searchKeywords);
            }
            catch (err) {
                parsedKeywords = searchKeywords.split(',').map((k) => k.trim());
            }
        }
        else if (Array.isArray(searchKeywords)) {
            parsedKeywords = searchKeywords;
        }
        let parsedMeta = {};
        if (typeof meta === 'string') {
            try {
                parsedMeta = JSON.parse(meta);
            }
            catch (err) { }
        }
        else if (meta) {
            parsedMeta = meta;
        }
        // Process uploaded images via Multer buffer files (fields middleware)
        const filesMap = req.files;
        const imageFiles = filesMap?.images;
        const images = [];
        if (imageFiles && imageFiles.length > 0) {
            for (const file of imageFiles) {
                const result = await uploadImageBuffer(file.buffer);
                images.push(result);
            }
        }
        // Also accept image URLs pasted into the form (no Cloudinary upload needed)
        images.push(...parseImageUrls(req.body.imageUrls));
        images.splice(5); // cap the gallery at 5
        // Per-variant photos (optional, matched by imageSlot index)
        await attachVariantImages(parsedVariants, filesMap?.variantImages || []);
        const basePrice = parseInt(basePriceCents);
        if (isNaN(basePrice) || basePrice < 0) {
            throw new AppError('VALIDATION_FAILED', 'Price must be a non-negative integer.', 422);
        }
        // Build model
        const product = await Product.create({
            name,
            description,
            brand,
            categoryId: new mongoose.Types.ObjectId(categoryId),
            basePriceCents: basePrice,
            variants: parsedVariants,
            images,
            searchKeywords: parsedKeywords,
            meta: parsedMeta,
            ratingAvg: 0,
            reviewCount: 0,
        });
        // Check variants for stock levels below threshold right away
        if (product.variants && product.variants.length > 0) {
            for (const v of product.variants) {
                await checkAndTriggerLowStock(product._id, v.sku, v.stock, v.lowStockThreshold);
            }
        }
        res.status(201).json({
            success: true,
            data: product,
        });
    }
    catch (error) {
        next(error);
    }
};
// 4. PATCH /api/products/:id - Manager Only
export const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        let { name, description, brand, categoryId, basePriceCents, variants, searchKeywords, meta, isTrending, isMostSelling } = req.body;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new AppError('VALIDATION_FAILED', 'Invalid product ID format.', 422);
        }
        const product = await Product.findById(id);
        if (!product) {
            throw new AppError('PRODUCT_NOT_FOUND', 'Product not found.', 404);
        }
        const beforeData = JSON.parse(JSON.stringify(product.toObject()));
        // Verify category if updated
        if (categoryId) {
            if (!mongoose.Types.ObjectId.isValid(categoryId)) {
                throw new AppError('VALIDATION_FAILED', 'Invalid categoryId format.', 422);
            }
            const cat = await Category.findById(categoryId);
            if (!cat) {
                throw new AppError('CATEGORY_NOT_FOUND', 'Category does not exist.', 404);
            }
            product.categoryId = new mongoose.Types.ObjectId(categoryId);
        }
        if (name)
            product.name = name;
        if (description)
            product.description = description;
        if (brand !== undefined)
            product.brand = brand;
        if (basePriceCents !== undefined) {
            const price = parseInt(basePriceCents);
            if (isNaN(price) || price < 0) {
                throw new AppError('VALIDATION_FAILED', 'Price must be a non-negative integer.', 422);
            }
            product.basePriceCents = price;
        }
        if (isTrending !== undefined)
            product.isTrending = !!isTrending;
        if (isMostSelling !== undefined)
            product.isMostSelling = !!isMostSelling;
        if (searchKeywords) {
            product.searchKeywords = Array.isArray(searchKeywords)
                ? searchKeywords
                : String(searchKeywords).split(',').map((k) => k.trim());
        }
        if (meta) {
            product.meta = { ...product.meta, ...meta };
        }
        // Rebuild the gallery from newly uploaded files and/or pasted URLs. If neither
        // is provided we leave the existing gallery untouched (so editing other fields
        // never wipes the images).
        const editFilesMap = req.files;
        const newImageFiles = editFilesMap?.images || [];
        const urlImages = parseImageUrls(req.body.imageUrls);
        if (newImageFiles.length > 0 || urlImages.length > 0) {
            const rebuilt = [];
            for (const file of newImageFiles.slice(0, 5)) {
                rebuilt.push(await uploadImageBuffer(file.buffer));
            }
            rebuilt.push(...urlImages);
            product.set('images', rebuilt.slice(0, 5));
        }
        // Track stock updates for audit logs
        let isStockUpdated = false;
        if (variants) {
            const parsedVariants = typeof variants === 'string' ? JSON.parse(variants) : variants;
            // New variant photos arrive as multipart files alongside the JSON
            const filesMap = req.files;
            await attachVariantImages(parsedVariants, filesMap?.variantImages || []);
            product.variants = parsedVariants;
            isStockUpdated = true;
        }
        await product.save();
        // Enforce Low Stock alarm checks on save
        if (product.variants && product.variants.length > 0) {
            for (const v of product.variants) {
                await checkAndTriggerLowStock(product._id, v.sku, v.stock, v.lowStockThreshold);
            }
        }
        // Write Audit Log if manager updated stock quantities
        if (isStockUpdated && req.user) {
            const actor = await User.findById(req.user.userId);
            await AuditLog.create({
                actorId: new mongoose.Types.ObjectId(req.user.userId),
                actorName: actor?.name || 'Inventory Manager',
                actionType: 'stock_update',
                targetEntityType: 'Product',
                targetEntityId: product._id,
                changeDelta: {
                    before: beforeData.variants,
                    after: product.variants,
                },
            });
        }
        res.status(200).json({
            success: true,
            data: product,
        });
    }
    catch (error) {
        next(error);
    }
};
// 5. DELETE /api/products/:id - Manager Only
export const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new AppError('VALIDATION_FAILED', 'Invalid product ID format.', 422);
        }
        const product = await Product.findById(id);
        if (!product) {
            throw new AppError('PRODUCT_NOT_FOUND', 'Product not found.', 404);
        }
        // Check if any pending/processing orders reference this product
        const referencedOrder = await Order.findOne({
            'items.productId': id,
            status: { $in: ['pending', 'confirmed', 'processing', 'shipped'] },
        });
        if (referencedOrder) {
            throw new AppError('PRODUCT_IN_PENDING_ORDER', `Cannot delete product. It is referenced in active order #${referencedOrder.orderNumber}.`, 409);
        }
        await Product.deleteOne({ _id: id });
        res.status(200).json({
            success: true,
            data: {
                message: 'Product deleted successfully.',
            },
        });
    }
    catch (error) {
        next(error);
    }
};
