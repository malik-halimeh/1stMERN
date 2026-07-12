import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import AuditLog from '../models/AuditLog.js';
import LowStockAlert from '../models/LowStockAlert.js';
import User from '../models/User.js';
import { uploadImageBuffer } from '../config/cloudinary.js';
import { AppError } from '../utils/errors.js';
// Every catalog image lives on a variant as an ordered `images` array —
// images[0] is the variant's default photo and the first variant's images[0]
// is the product's card image storefront-wide. There is no standalone
// product gallery anymore.
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
        // Sorting overrides (explicit sort wins over relevance ranking below)
        let sortOption = { createdAt: -1 };
        if (sort === 'price_asc')
            sortOption = { basePriceCents: 1 };
        else if (sort === 'price_desc')
            sortOption = { basePriceCents: -1 };
        else if (sort === 'rating_desc')
            sortOption = { ratingAvg: -1 };
        else if (sort === 'newest')
            sortOption = { createdAt: -1 };
        // Search: substring (regex) match across name/brand/keywords/description so
        // partial and as-you-type queries work — a $text index only matches whole
        // words. Results are ranked exact-name → name-prefix → name-substring →
        // brand → everything else, so the closest product always surfaces first.
        let products;
        if (search && String(search).trim()) {
            const q = String(search).trim();
            const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(safe, 'i');
            filter.$or = [{ name: rx }, { brand: rx }, { searchKeywords: rx }, { description: rx }];
            const rankSort = sort ? sortOption : { searchRank: 1, ratingAvg: -1, createdAt: -1 };
            products = await Product.aggregate([
                { $match: filter },
                {
                    $addFields: {
                        searchRank: {
                            $switch: {
                                branches: [
                                    { case: { $eq: [{ $toLower: '$name' }, q.toLowerCase()] }, then: 0 },
                                    { case: { $regexMatch: { input: '$name', regex: `^${safe}`, options: 'i' } }, then: 1 },
                                    { case: { $regexMatch: { input: '$name', regex: safe, options: 'i' } }, then: 2 },
                                    { case: { $regexMatch: { input: { $ifNull: ['$brand', ''] }, regex: safe, options: 'i' } }, then: 3 },
                                ],
                                default: 4,
                            },
                        },
                    },
                },
                { $sort: rankSort },
                { $skip: skip },
                { $limit: limit },
                { $project: { searchRank: 0 } },
            ]);
        }
        else {
            products = await Product.find(filter).sort(sortOption).skip(skip).limit(limit);
        }
        const total = await Product.countDocuments(filter);
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
        const products = await Product.find({ _id: { $in: validIds } }).select('name slug brand basePriceCents variants ratingAvg reviewCount isTrending isMostSelling');
        res.status(200).json({ success: true, data: products });
    }
    catch (error) {
        next(error);
    }
};
// Resolve each variant's ordered image list. The client sends every variant
// with an `images` array whose entries are either:
//   { fileSlot: n }            — the n-th uploaded `variantImages` file
//   { url, publicId? }         — an existing stored image or a pasted URL
// Order in the array is the display order the admin arranged, so it is
// preserved verbatim. Files are uploaded to Cloudinary once, then slotted in.
// Pasted / external URLs are stored with publicId 'external' so we never try
// to delete them from Cloudinary; the frontend renders both identically.
const attachVariantImages = async (parsedVariants, variantImageFiles) => {
    const uploads = [];
    for (const file of variantImageFiles) {
        uploads.push(await uploadImageBuffer(file.buffer));
    }
    for (const v of parsedVariants) {
        const entries = Array.isArray(v.images) ? v.images : [];
        const images = [];
        for (const entry of entries) {
            if (entry && typeof entry.fileSlot === 'number') {
                const uploaded = uploads[entry.fileSlot];
                if (!uploaded) {
                    throw new AppError('VALIDATION_FAILED', `Variant "${v.sku}" references uploaded image #${entry.fileSlot + 1}, but that file was not received.`, 422);
                }
                images.push(uploaded);
            }
            else if (entry && typeof entry.url === 'string' && /^https?:\/\//i.test(entry.url.trim())) {
                images.push({ url: entry.url.trim(), publicId: entry.publicId || 'external' });
            }
            else if (entry) {
                throw new AppError('VALIDATION_FAILED', `Variant "${v.sku}" has an invalid image entry — expected an uploaded file or an http(s) URL.`, 422);
            }
        }
        v.images = images;
        // Legacy single-image fields are no longer accepted
        delete v.image;
        delete v.imageSlot;
        delete v.imageUrl;
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
        // Variant images: uploaded files ride in the `variantImages` multipart
        // field; ordering + URL entries come from each variant's `images` array
        const filesMap = req.files;
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
