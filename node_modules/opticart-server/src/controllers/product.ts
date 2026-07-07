import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import AuditLog from '../models/AuditLog.js';
import LowStockAlert from '../models/LowStockAlert.js';
import User from '../models/User.js';
import { uploadImageBuffer } from '../config/cloudinary.js';
import { AppError } from '../utils/errors.js';

// Helper to trigger stock alerts gracefully
const checkAndTriggerLowStock = async (
  productId: mongoose.Types.ObjectId,
  variantSku: string,
  currentStock: number,
  threshold: number
) => {
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
    } catch (error: any) {
      if (error.code === 11000) {
        // Enforced by compound index: one active alert per variant. Suppress duplicate-key errors.
        console.log(`Active low stock alert already exists for ${productId} (${variantSku}).`);
      } else {
        console.error('Error triggering low stock alert:', error.message);
      }
    }
  }
};

// 1. GET /api/products - Public listing w/ queries
export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const { category, minPrice, maxPrice, rating, sort, search } = req.query;

    const filter: Record<string, any> = {};

    // Category Filter
    if (category) {
      let catId: mongoose.Types.ObjectId | null = null;
      if (mongoose.Types.ObjectId.isValid(category as string)) {
        catId = new mongoose.Types.ObjectId(category as string);
      } else {
        const catDoc = await Category.findOne({ slug: category as string });
        if (catDoc) catId = catDoc._id as mongoose.Types.ObjectId;
      }

      if (catId) {
        // Match categoryId or any subcategory child referencing it
        const childCats = await Category.find({ parentId: catId });
        const catIds = [catId, ...childCats.map((c) => c._id)];
        filter.categoryId = { $in: catIds };
      } else {
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
        filter.basePriceCents.$gte = Math.round(parseFloat(minPrice as string) * 100);
      }
      if (maxPrice) {
        filter.basePriceCents.$lte = Math.round(parseFloat(maxPrice as string) * 100);
      }
    }

    // Average Rating Filter
    if (rating) {
      filter.ratingAvg = { $gte: parseFloat(rating as string) };
    }

    // Full-Text Search index
    let sortOption: any = { createdAt: -1 };
    if (search) {
      filter.$text = { $search: String(search) };
      sortOption = { score: { $meta: 'textScore' } };
    }

    // Sorting overrides
    if (sort) {
      if (sort === 'price_asc') sortOption = { basePriceCents: 1 };
      else if (sort === 'price_desc') sortOption = { basePriceCents: -1 };
      else if (sort === 'rating_desc') sortOption = { ratingAvg: -1 };
      else if (sort === 'newest') sortOption = { createdAt: -1 };
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
  } catch (error) {
    next(error);
  }
};

// 2. GET /api/products/:slug - Public single product
export const getProductBySlug = async (req: Request, res: Response, next: NextFunction) => {
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
  } catch (error) {
    next(error);
  }
};

// 3. POST /api/products - Manager Only (Multipart Cloudinary Upload)
export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
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
    let parsedVariants: any[] = [];
    if (typeof variants === 'string') {
      try {
        parsedVariants = JSON.parse(variants);
      } catch (err) {
        throw new AppError('VALIDATION_FAILED', 'Variants field must be a valid JSON array string.', 422);
      }
    } else if (Array.isArray(variants)) {
      parsedVariants = variants;
    }

    let parsedKeywords: string[] = [];
    if (typeof searchKeywords === 'string') {
      try {
        parsedKeywords = JSON.parse(searchKeywords);
      } catch (err) {
        parsedKeywords = searchKeywords.split(',').map((k: string) => k.trim());
      }
    } else if (Array.isArray(searchKeywords)) {
      parsedKeywords = searchKeywords;
    }

    let parsedMeta: any = {};
    if (typeof meta === 'string') {
      try {
        parsedMeta = JSON.parse(meta);
      } catch (err) {}
    } else if (meta) {
      parsedMeta = meta;
    }

    // Process uploaded images via Multer buffer files
    const imageFiles = req.files as Express.Multer.File[] | undefined;
    const images: { url: string; publicId: string }[] = [];

    if (imageFiles && imageFiles.length > 0) {
      for (const file of imageFiles) {
        const result = await uploadImageBuffer(file.buffer);
        images.push(result);
      }
    }

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
        await checkAndTriggerLowStock(
          product._id as mongoose.Types.ObjectId,
          v.sku,
          v.stock,
          v.lowStockThreshold
        );
      }
    }

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// 4. PATCH /api/products/:id - Manager Only
export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
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

    if (name) product.name = name;
    if (description) product.description = description;
    if (brand !== undefined) product.brand = brand;
    if (basePriceCents !== undefined) {
      const price = parseInt(basePriceCents);
      if (isNaN(price) || price < 0) {
        throw new AppError('VALIDATION_FAILED', 'Price must be a non-negative integer.', 422);
      }
      product.basePriceCents = price;
    }

    if (isTrending !== undefined) product.isTrending = !!isTrending;
    if (isMostSelling !== undefined) product.isMostSelling = !!isMostSelling;

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
      product.variants = parsedVariants;
      isStockUpdated = true;
    }

    await product.save();

    // Enforce Low Stock alarm checks on save
    if (product.variants && product.variants.length > 0) {
      for (const v of product.variants) {
        await checkAndTriggerLowStock(
          product._id as mongoose.Types.ObjectId,
          v.sku,
          v.stock,
          v.lowStockThreshold
        );
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
  } catch (error) {
    next(error);
  }
};

// 5. DELETE /api/products/:id - Manager Only
export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
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
      throw new AppError(
        'PRODUCT_IN_PENDING_ORDER',
        `Cannot delete product. It is referenced in active order #${referencedOrder.orderNumber}.`,
        409
      );
    }

    await Product.deleteOne({ _id: id });

    res.status(200).json({
      success: true,
      data: {
        message: 'Product deleted successfully.',
      },
    });
  } catch (error) {
    next(error);
  }
};
