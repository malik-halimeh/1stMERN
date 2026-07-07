import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import LowStockAlert from '../models/LowStockAlert.js';
import User from '../models/User.js';
import { AppError } from '../utils/errors.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_key');

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
        console.log(`Active low stock alert already exists for ${productId} (${variantSku}).`);
      } else {
        console.error('Error triggering low stock alert:', error.message);
      }
    }
  }
};

// 1. POST /api/orders/checkout-session - Create Stripe PaymentIntent & Pending Order
export const createCheckoutSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }

    const { shippingAddress, couponCode } = req.body;

    if (!shippingAddress || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.country) {
      throw new AppError('VALIDATION_FAILED', 'Shipping address details are required.', 422);
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const cart = await Cart.findOne({ userId });

    if (!cart || cart.items.length === 0) {
      throw new AppError('VALIDATION_FAILED', 'Your shopping cart is empty.', 422);
    }

    // Snapshot cart items and validate stock availability
    const cartItemsSnapshot = [];
    let subtotalCents = 0;

    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        throw new AppError('PRODUCT_NOT_FOUND', `Product not found: ${item.productId}`, 404);
      }

      const variant = product.variants.find((v) => v.sku === item.variantSku);
      if (!variant) {
        throw new AppError('VARIANT_NOT_FOUND', `Product variant not found: ${item.variantSku}`, 404);
      }

      if (variant.stock < item.quantity) {
        throw new AppError(
          'INSUFFICIENT_STOCK',
          `Insufficient stock for variant "${variant.color || ''} ${variant.capacity || ''}". Only ${variant.stock} available.`,
          409
        );
      }

      const itemPriceCents = product.basePriceCents + variant.priceDeltaCents;
      subtotalCents += itemPriceCents * item.quantity;

      cartItemsSnapshot.push({
        productId: item.productId,
        name: product.name,
        variantSku: item.variantSku,
        unitPriceCents: itemPriceCents,
        unitCostCents: variant.costPriceCents || Math.round(itemPriceCents * 0.6), // default estimate cost
        quantity: item.quantity,
      });
    }

    // Apply coupon if sent
    let discountCents = 0;
    if (couponCode) {
      const normalizedCode = couponCode.toUpperCase().trim();
      const coupon = await Coupon.findOne({ code: normalizedCode });
      if (coupon && coupon.isActive && new Date(coupon.expiryDate) > new Date() && subtotalCents >= coupon.minOrderValueCents) {
        if (coupon.type === 'percentage') {
          discountCents = Math.round(subtotalCents * (coupon.value / 100));
        } else if (coupon.type === 'fixed') {
          discountCents = coupon.value;
        }
        discountCents = Math.min(discountCents, subtotalCents);
      }
    }

    const totalCents = Math.max(0, subtotalCents - discountCents);

    // Create Stripe PaymentIntent (with mock support for development)
    let paymentIntentId = '';
    let clientSecret = '';

    const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock_key';

    if (isMock) {
      paymentIntentId = `mock_pi_${Math.random().toString(36).substr(2, 9)}`;
      clientSecret = `mock_secret_${Math.random().toString(36).substr(2, 12)}`;
    } else {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: 'usd',
        metadata: {
          userId: req.user.userId,
          couponCode: couponCode || '',
        },
      });
      paymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret || '';
    }

    // Create Draft Pending Order in DB
    const order = await Order.create({
      userId,
      orderNumber: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
      items: cartItemsSnapshot,
      subtotalCents,
      discountCents,
      totalCents,
      shippingAddress,
      status: 'pending',
      paymentStatus: 'pending',
      stripePaymentIntentId: paymentIntentId,
      couponCode: couponCode || null,
      createdAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: {
        clientSecret,
        paymentIntentId,
        orderId: order._id,
        subtotalCents,
        discountCents,
        totalCents,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. POST /api/orders/webhook - Stripe Webhook payment receiver
export const stripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock_key';
    
    let event: any;
    
    if (isMock) {
      event = req.body;
    } else {
      const sig = req.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (webhookSecret && sig) {
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err: any) {
          console.warn('Webhook signature check failed. Falling back to body parsing for local/mock tools.');
          event = req.body;
        }
      } else {
        event = req.body;
      }
    }

    // Handle payment_intent.succeeded
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const paymentIntentId = paymentIntent.id;

      const order = await Order.findOne({ stripePaymentIntentId: paymentIntentId });

      if (order && order.status === 'pending') {
        // Transition order state
        order.status = 'confirmed';
        order.paymentStatus = 'succeeded';

        // Decrement variants stock and check low-stock triggers
        for (const item of order.items) {
          const product = await Product.findById(item.productId);
          if (product) {
            const variant = product.variants.find((v) => v.sku === item.variantSku);
            if (variant) {
              variant.stock = Math.max(0, variant.stock - item.quantity);
              await product.save();

              // Trigger low stock warning alert
              await checkAndTriggerLowStock(
                product._id as mongoose.Types.ObjectId,
                variant.sku,
                variant.stock,
                variant.lowStockThreshold
              );
            }
          }
        }

        // Increment coupon count if coupon code was used
        if (order.couponCode) {
          const coupon = await Coupon.findOne({ code: order.couponCode });
          if (coupon) {
            const usageIdx = coupon.usedBy.findIndex((u) => u.userId.toString() === order.userId.toString());
            if (usageIdx > -1) {
              coupon.usedBy[usageIdx].count += 1;
            } else {
              coupon.usedBy.push({ userId: order.userId, count: 1 });
            }
            await coupon.save();
          }
        }

        // Clear user cart items
        await Cart.updateOne({ userId: order.userId }, { $set: { items: [] } });
        
        await order.save();
        console.log(`✓ Order ${order.orderNumber} successfully confirmed via webhook!`);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};

// 3. GET /api/orders/status/:paymentIntentId - Poll checkout confirmations
export const getOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentIntentId } = req.params;
    const order = await Order.findOne({ stripePaymentIntentId: paymentIntentId });

    if (!order) {
      return res.status(200).json({
        success: true,
        confirmed: false,
      });
    }

    res.status(200).json({
      success: true,
      confirmed: order.status !== 'pending',
      order,
    });
  } catch (error) {
    next(error);
  }
};

// 4. GET /api/orders - Get Orders History (Paginated)
export const getOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter = { userId: new mongoose.Types.ObjectId(req.user.userId) };

    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: orders,
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

// 5. GET /api/orders/:id - Get Order Details
export const getOrderDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid order ID format.', 422);
    }

    const order = await Order.findById(id);

    if (!order) {
      throw new AppError('ORDER_NOT_FOUND', 'Order not found.', 404);
    }

    // Owner or admin permissions verify
    if (order.userId.toString() !== req.user.userId && req.user.role === 'customer') {
      throw new AppError('AUTH_FORBIDDEN', 'Access denied. You do not own this order.', 403);
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
