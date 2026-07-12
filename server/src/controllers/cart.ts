import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/errors.js';

// Helper to calculate variant price
const getVariantPrice = (basePrice: number, priceDelta: number) => basePrice + priceDelta;

// 1. GET /api/cart - Customer Only
export const getCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }

    // Populate and validate cart items live
    const validatedItems: any[] = [];
    let cartModified = false;

    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        // Product no longer exists, drop from cart
        cartModified = true;
        continue;
      }

      const variant = product.variants.find((v) => v.sku === item.variantSku);
      if (!variant) {
        // Variant no longer exists, drop from cart
        cartModified = true;
        continue;
      }

      const currentPrice = getVariantPrice(product.basePriceCents, variant.priceDeltaCents);
      const isPriceChanged = item.priceAtAddCents !== currentPrice;
      const isLowStock = variant.stock < item.quantity;
      const isOutOfStock = variant.stock === 0;

      validatedItems.push({
        productId: item.productId,
        productName: product.name,
        brand: product.brand,
        slug: product.slug,
        // The purchased variant's default photo; falls back to the product's
        // card image (first image of the first variant)
        image: variant.images?.[0]?.url || product.variants[0]?.images?.[0]?.url || '',
        variantSku: item.variantSku,
        color: variant.color,
        size: variant.size,
        capacity: variant.capacity,
        quantity: item.quantity,
        priceAtAddCents: item.priceAtAddCents,
        currentPriceCents: currentPrice,
        priceChanged: isPriceChanged,
        insufficientStock: isLowStock,
        outOfStock: isOutOfStock,
        availableStock: variant.stock,
      });
    }

    // If any items were removed automatically (e.g. products deleted from catalog)
    if (cartModified) {
      cart.items = cart.items.filter((item) =>
        validatedItems.some((val) => val.productId.toString() === item.productId.toString() && val.variantSku === item.variantSku)
      );
      await cart.save();
    }

    res.status(200).json({
      success: true,
      data: {
        _id: cart._id,
        userId: cart.userId,
        items: validatedItems,
        updatedAt: cart.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. POST /api/cart/items - Add to Cart
export const addToCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }

    const { productId, variantSku, quantity } = req.body;
    const qty = parseInt(quantity);

    if (!productId || !variantSku || isNaN(qty) || qty <= 0) {
      throw new AppError('VALIDATION_FAILED', 'Invalid product ID, variant SKU, or quantity.', 422);
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid product ID format.', 422);
    }

    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found.', 404);
    }

    const variant = product.variants.find((v) => v.sku === variantSku);
    if (!variant) {
      throw new AppError('VARIANT_NOT_FOUND', 'Product variant not found.', 404);
    }

    // Validate stock availability
    if (variant.stock < qty) {
      throw new AppError(
        'INSUFFICIENT_STOCK',
        `Insufficient stock. Only ${variant.stock} items are available.`,
        409
      );
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }

    const currentPrice = getVariantPrice(product.basePriceCents, variant.priceDeltaCents);

    // Check if item already in cart
    const existingItemIdx = cart.items.findIndex(
      (item) => item.productId.toString() === productId && item.variantSku === variantSku
    );

    const alreadyInCart = existingItemIdx > -1;

    if (!alreadyInCart) {
      // Only one row per product+variant: repeat adds leave the cart untouched
      // and the client tells the user it is already there. Quantity is only
      // changed from the Cart page (PATCH /cart/items/:productId).
      cart.items.push({
        productId: new mongoose.Types.ObjectId(productId),
        variantSku,
        quantity: qty,
        priceAtAddCents: currentPrice,
      });
      await cart.save();
    }

    res.status(200).json({
      success: true,
      alreadyInCart,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

// 3. PATCH /api/cart/items/:productId - Update Quantity
export const updateCartItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }

    const { productId } = req.params;
    const { variantSku, quantity } = req.body;
    const qty = parseInt(quantity);

    if (!mongoose.Types.ObjectId.isValid(productId) || !variantSku || isNaN(qty) || qty <= 0) {
      throw new AppError('VALIDATION_FAILED', 'Invalid input arguments.', 422);
    }

    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found.', 404);
    }

    const variant = product.variants.find((v) => v.sku === variantSku);
    if (!variant) {
      throw new AppError('VARIANT_NOT_FOUND', 'Product variant not found.', 404);
    }

    // Validate stock
    if (variant.stock < qty) {
      throw new AppError(
        'INSUFFICIENT_STOCK',
        `Insufficient stock. Only ${variant.stock} items are available.`,
        409
      );
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new AppError('CART_NOT_FOUND', 'Cart not found.', 404);
    }

    const itemIdx = cart.items.findIndex(
      (item) => item.productId.toString() === productId && item.variantSku === variantSku
    );

    if (itemIdx === -1) {
      throw new AppError('CART_ITEM_NOT_FOUND', 'Item not found in your cart.', 404);
    }

    cart.items[itemIdx].quantity = qty;
    cart.items[itemIdx].priceAtAddCents = getVariantPrice(product.basePriceCents, variant.priceDeltaCents);
    await cart.save();

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

// 4. DELETE /api/cart/items/:productId - Remove from Cart
export const removeCartItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }

    const { productId } = req.params;
    const { variantSku } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId) || !variantSku) {
      throw new AppError('VALIDATION_FAILED', 'Invalid product ID or variant SKU.', 422);
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new AppError('CART_NOT_FOUND', 'Cart not found.', 404);
    }

    const beforeLength = cart.items.length;
    cart.items = cart.items.filter(
      (item) => !(item.productId.toString() === productId && item.variantSku === variantSku)
    );

    if (cart.items.length === beforeLength) {
      throw new AppError('CART_ITEM_NOT_FOUND', 'Item not found in your cart.', 404);
    }

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

// 5. POST /api/cart/merge - Merge Guest Cart Items
export const mergeCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }

    const { items } = req.body;
    if (!Array.isArray(items)) {
      throw new AppError('VALIDATION_FAILED', 'Items parameter must be a valid array.', 422);
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }

    for (const guestItem of items) {
      const { productId, variantSku, quantity } = guestItem;
      const qty = parseInt(quantity);
      if (!productId || !variantSku || isNaN(qty) || qty <= 0) {
        continue;
      }

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        continue;
      }

      const product = await Product.findById(productId);
      if (!product) continue;

      const variant = product.variants.find((v) => v.sku === variantSku);
      if (!variant) continue;

      const currentPrice = product.basePriceCents + variant.priceDeltaCents;

      // Find duplicate items
      const existingIdx = cart.items.findIndex(
        (item) => item.productId.toString() === productId && item.variantSku === variantSku
      );

      if (existingIdx > -1) {
        // Resolve conflict with max(quantity)
        const finalQty = Math.max(cart.items[existingIdx].quantity, qty);
        // Cap at variant's stock availability
        cart.items[existingIdx].quantity = Math.min(finalQty, variant.stock);
        cart.items[existingIdx].priceAtAddCents = currentPrice;
      } else {
        // Cap at variant's stock availability
        const cappedQty = Math.min(qty, variant.stock);
        if (cappedQty > 0) {
          cart.items.push({
            productId: new mongoose.Types.ObjectId(productId),
            variantSku,
            quantity: cappedQty,
            priceAtAddCents: currentPrice,
          });
        }
      }
    }

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

