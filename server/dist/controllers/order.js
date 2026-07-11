import mongoose from 'mongoose';
import Stripe from 'stripe';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import LowStockAlert from '../models/LowStockAlert.js';
import User from '../models/User.js';
import ProductEvent from '../models/ProductEvent.js';
import { sendOrderConfirmationEmail, sendOrderStatusChangeEmail } from '../services/mailer.js';
import { AppError } from '../utils/errors.js';
import { escapeRegex } from '../utils/escapeRegex.js';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_key');
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
            // Fire low-stock email to all inventory managers (non-blocking)
            const { sendLowStockAlertEmail } = await import('../services/mailer.js');
            sendLowStockAlertEmail(variantSku, currentStock).catch((err) => console.error('Low stock email failed:', err.message));
        }
        catch (error) {
            if (error.code === 11000) {
                console.log(`Active low stock alert already exists for ${productId} (${variantSku}).`);
            }
            else {
                console.error('Error triggering low stock alert:', error.message);
            }
        }
    }
};
// 1. POST /api/orders/checkout-session - Create Stripe PaymentIntent & Pending Order
export const createCheckoutSession = async (req, res, next) => {
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
                throw new AppError('INSUFFICIENT_STOCK', `Insufficient stock for variant "${variant.color || ''} ${variant.capacity || ''}". Only ${variant.stock} available.`, 409);
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
        // Apply coupon if sent — re-validate ALL the rules /coupons/apply enforces
        // (a couponCode sent straight to checkout must not bypass usage caps).
        let discountCents = 0;
        if (couponCode) {
            const normalizedCode = couponCode.toUpperCase().trim();
            const coupon = await Coupon.findOne({ code: normalizedCode });
            if (!coupon) {
                throw new AppError('COUPON_NOT_FOUND', 'Invalid or unrecognized coupon code.', 404);
            }
            if (!coupon.isActive) {
                throw new AppError('COUPON_INACTIVE', 'This coupon code has been deactivated.', 400);
            }
            if (new Date(coupon.expiryDate) < new Date()) {
                throw new AppError('COUPON_EXPIRED', 'This coupon code has expired.', 400);
            }
            if (subtotalCents < coupon.minOrderValueCents) {
                const minValDollars = (coupon.minOrderValueCents / 100).toFixed(2);
                throw new AppError('COUPON_MIN_ORDER_LIMIT', `Minimum order subtotal of $${minValDollars} is required to apply this coupon.`, 400);
            }
            const totalUsages = coupon.usedBy.reduce((acc, curr) => acc + curr.count, 0);
            if (totalUsages >= coupon.usageLimit) {
                throw new AppError('COUPON_LIMIT_EXCEEDED', 'This coupon has reached its maximum global usage limit.', 400);
            }
            const userUsage = coupon.usedBy.find((u) => u.userId.toString() === req.user?.userId);
            if (userUsage && userUsage.count >= coupon.perUserLimit) {
                throw new AppError('COUPON_USER_LIMIT_EXCEEDED', 'You have already reached the maximum usage limit for this coupon.', 400);
            }
            if (coupon.type === 'percentage') {
                discountCents = Math.round(subtotalCents * (coupon.value / 100));
            }
            else if (coupon.type === 'fixed') {
                discountCents = coupon.value;
            }
            discountCents = Math.min(discountCents, subtotalCents);
        }
        const totalCents = Math.max(0, subtotalCents - discountCents);
        // Create Stripe PaymentIntent (with mock support for development)
        let paymentIntentId = '';
        let clientSecret = '';
        const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock_key';
        if (isMock) {
            paymentIntentId = `mock_pi_${Math.random().toString(36).substr(2, 9)}`;
            clientSecret = `mock_secret_${Math.random().toString(36).substr(2, 12)}`;
        }
        else {
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
            paymentIntentId: paymentIntentId,
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
    }
    catch (error) {
        next(error);
    }
};
// 2. POST /api/orders/webhook - Stripe Webhook payment receiver
// The route is mounted with express.raw (see server.ts), so req.body is the
// raw Buffer — required because constructEvent verifies a signature over the
// exact bytes Stripe sent, which a parsed-then-restringified body can't match.
export const stripeWebhook = async (req, res, next) => {
    try {
        const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock_key';
        const rawBody = req.body;
        const parseRawJson = () => {
            if (Buffer.isBuffer(rawBody))
                return JSON.parse(rawBody.toString('utf8'));
            return rawBody; // already-parsed body (e.g. direct controller invocation in tests)
        };
        let event;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!isMock && webhookSecret) {
            // Real Stripe mode with a configured secret: FAIL CLOSED. An unsigned or
            // tampered payload must never be able to mark an order as paid.
            const sig = req.headers['stripe-signature'];
            if (!sig || !Buffer.isBuffer(rawBody)) {
                throw new AppError('WEBHOOK_SIGNATURE_MISSING', 'Stripe signature header is required.', 400);
            }
            try {
                event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
            }
            catch (err) {
                throw new AppError('WEBHOOK_SIGNATURE_INVALID', 'Stripe webhook signature verification failed.', 400);
            }
        }
        else {
            // Mock/dev mode (no real key or no webhook secret yet): the client's
            // MockPaymentForm posts the event itself, so parse the JSON body as-is.
            event = parseRawJson();
        }
        // Handle payment_intent.succeeded
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            const paymentIntentId = paymentIntent.id;
            const order = await Order.findOne({ paymentIntentId: paymentIntentId });
            // Idempotency guard on paymentStatus: the order itself STAYS 'pending'
            // until staff presses Confirm in the admin panel — payment success only
            // captures funds, reserves stock, and clears the cart.
            if (order && order.paymentStatus === 'pending') {
                order.paymentStatus = 'succeeded';
                // Decrement variants stock and check low-stock triggers.
                // Atomic conditional $inc: the stock >= quantity guard is part of the
                // query, so two near-simultaneous payments for the last units can't
                // both decrement past zero (the old read-modify-save pattern could).
                for (const item of order.items) {
                    const decremented = await Product.findOneAndUpdate({
                        _id: item.productId,
                        variants: { $elemMatch: { sku: item.variantSku, stock: { $gte: item.quantity } } },
                    }, { $inc: { 'variants.$.stock': -item.quantity } }, { new: true });
                    let product = decremented;
                    if (!product) {
                        // Lost the race (or stock drifted): clamp the variant to 0 and log
                        // the oversell so staff can resolve it during confirmation.
                        product = await Product.findOneAndUpdate({ _id: item.productId, 'variants.sku': item.variantSku }, { $set: { 'variants.$.stock': 0 } }, { new: true });
                        if (product) {
                            console.warn(`⚠ Oversell detected on ${item.variantSku} (order ${order.orderNumber}): paid quantity ${item.quantity} exceeded remaining stock. Variant clamped to 0.`);
                        }
                    }
                    if (product) {
                        const variant = product.variants.find((v) => v.sku === item.variantSku);
                        if (variant) {
                            // Trigger low stock warning alert
                            await checkAndTriggerLowStock(product._id, variant.sku, variant.stock, variant.lowStockThreshold);
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
                        }
                        else {
                            coupon.usedBy.push({ userId: order.userId, count: 1 });
                        }
                        await coupon.save();
                    }
                }
                // Clear user cart items
                await Cart.updateOne({ userId: order.userId }, { $set: { items: [] } });
                // Record productEvent 'purchase' per item for recommendation engine
                try {
                    const purchaseEvents = order.items.map((item) => ({
                        userId: order.userId,
                        productId: item.productId,
                        eventType: 'purchase',
                        timestamp: new Date(),
                    }));
                    await ProductEvent.insertMany(purchaseEvents);
                }
                catch (evtErr) {
                    console.error('Failed to record purchase events:', evtErr.message);
                }
                await order.save();
                console.log(`✓ Order ${order.orderNumber} payment captured — awaiting staff confirmation.`);
                // Fire order confirmation email (non-blocking)
                try {
                    const buyer = await User.findById(order.userId);
                    if (buyer) {
                        sendOrderConfirmationEmail(buyer.email, order.orderNumber, order.totalCents);
                    }
                }
                catch (mailErr) {
                    console.error('Failed to send confirmation email:', mailErr.message);
                }
            }
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        next(error);
    }
};
// 3. GET /api/orders/status/:paymentIntentId - Poll checkout confirmations
export const getOrderStatus = async (req, res, next) => {
    try {
        const { paymentIntentId } = req.params;
        const order = await Order.findOne({ paymentIntentId: paymentIntentId });
        if (!order) {
            return res.status(200).json({
                success: true,
                confirmed: false,
            });
        }
        res.status(200).json({
            success: true,
            // "Confirmed" here means the PAYMENT went through — the order itself
            // stays 'pending' until staff confirms it in the admin panel
            confirmed: order.paymentStatus === 'succeeded' || order.status !== 'pending',
            order,
        });
    }
    catch (error) {
        next(error);
    }
};
// 4. GET /api/orders - Get Orders History (Paginated)
export const getOrders = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
        }
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        // Staff (fulfillment queue) see all orders, optionally filtered by status;
        // customers only ever see their own. `?scope=mine` forces the personal
        // view (My Account) so staff also see just their OWN orders there.
        const mineOnly = req.query.scope === 'mine';
        const isStaff = !mineOnly && (req.user.role === 'inventory_manager' || req.user.role === 'super_admin');
        const filter = isStaff
            ? {}
            : { userId: new mongoose.Types.ObjectId(req.user.userId) };
        const statusFilter = req.query.status;
        if (isStaff && statusFilter) {
            filter.status = statusFilter;
        }
        // Staff quick search by order number (partial, case-insensitive)
        const q = req.query.q;
        if (isStaff && q?.trim()) {
            filter.orderNumber = { $regex: escapeRegex(q), $options: 'i' };
        }
        const total = await Order.countDocuments(filter);
        let query = Order.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 });
        if (isStaff) {
            query = query.populate('userId', 'name email');
        }
        const orders = await query;
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
    }
    catch (error) {
        next(error);
    }
};
// 5. GET /api/orders/:id - Get Order Details
export const getOrderDetails = async (req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
};
// 6b. POST /api/orders/:id/feedback - Order owner leaves feedback once the
// order has been confirmed by staff (any status beyond 'pending').
export const submitOrderFeedback = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('AUTH_UNAUTHORIZED', 'Session is not authenticated.', 401);
        }
        const { id } = req.params;
        const { rating, text } = req.body;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new AppError('VALIDATION_FAILED', 'Invalid order ID format.', 422);
        }
        const parsedRating = parseInt(rating);
        if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
            throw new AppError('VALIDATION_FAILED', 'Rating must be a number between 1 and 5.', 422);
        }
        if (!text || typeof text !== 'string' || !text.trim()) {
            throw new AppError('VALIDATION_FAILED', 'Feedback text is required.', 422);
        }
        const order = await Order.findById(id);
        if (!order) {
            throw new AppError('ORDER_NOT_FOUND', 'Order not found.', 404);
        }
        // Only the order owner can leave feedback
        if (order.userId.toString() !== req.user.userId) {
            throw new AppError('AUTH_FORBIDDEN', 'You can only leave feedback on your own orders.', 403);
        }
        // Feedback opens once staff has confirmed the order
        if (order.status === 'pending') {
            throw new AppError('ORDER_NOT_CONFIRMED', 'Feedback is available after your order has been confirmed.', 409);
        }
        order.feedback = {
            rating: parsedRating,
            text: text.trim().slice(0, 2000),
            createdAt: new Date(),
        };
        await order.save();
        res.status(200).json({
            success: true,
            data: order,
        });
    }
    catch (error) {
        next(error);
    }
};
// 6. PATCH /api/orders/:id/status - Inventory Manager Only
// Valid transitions: confirmed→processing→shipped→delivered | any→cancelled | any→refunded
export const updateOrderStatus = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('AUTH_UNAUTHORIZED', 'Session is not authenticated.', 401);
        }
        const { id } = req.params;
        const { status, note } = req.body;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new AppError('VALIDATION_FAILED', 'Invalid order ID format.', 422);
        }
        const validStatuses = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
        if (!status || !validStatuses.includes(status)) {
            throw new AppError('VALIDATION_FAILED', `Status must be one of: ${validStatuses.join(', ')}.`, 422);
        }
        // Cancellations and refunds must carry a reason the customer will see
        const reason = typeof note === 'string' ? note.trim().slice(0, 500) : '';
        if ((status === 'cancelled' || status === 'refunded') && !reason) {
            throw new AppError('VALIDATION_FAILED', `A reason is required when marking an order as ${status}.`, 422);
        }
        const order = await Order.findById(id);
        if (!order) {
            throw new AppError('ORDER_NOT_FOUND', 'Order not found.', 404);
        }
        // State machine guard: cannot move backwards or change from terminal states
        const terminalStatuses = ['delivered', 'cancelled', 'refunded'];
        if (terminalStatuses.includes(order.status)) {
            throw new AppError('ORDER_STATUS_LOCKED', `Order is already in terminal state: ${order.status}.`, 409);
        }
        const prevStatus = order.status;
        // Refunds actually move money: issue the Stripe refund BEFORE persisting
        // the status, so a failed refund never leaves an order marked "refunded"
        // while the customer was never repaid. Mock mode records a mock refund id.
        if (status === 'refunded') {
            const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock_key';
            let stripeRefundId;
            if (!isMock && order.paymentIntentId && order.paymentStatus === 'succeeded') {
                try {
                    const stripeRefund = await stripe.refunds.create({
                        payment_intent: order.paymentIntentId,
                    });
                    stripeRefundId = stripeRefund.id;
                }
                catch (refundErr) {
                    throw new AppError('REFUND_FAILED', `Stripe refund failed: ${refundErr.message}. The order status was NOT changed.`, 502);
                }
            }
            else {
                stripeRefundId = `mock_re_${Math.random().toString(36).substr(2, 9)}`;
            }
            order.refund = {
                status: 'approved',
                reason,
                approvedBy: new mongoose.Types.ObjectId(req.user.userId),
                approvedAt: new Date(),
                stripeRefundId,
            };
        }
        order.status = status;
        // Timestamp terminal transitions
        if (status === 'delivered')
            order.deliveredAt = new Date();
        if (status === 'cancelled')
            order.cancelledAt = new Date();
        // Append statusHistory entry
        order.statusHistory.push({
            status,
            timestamp: new Date(),
            note: reason || `Status updated to ${status}.`,
            updatedBy: new mongoose.Types.ObjectId(req.user.userId),
        });
        await order.save();
        // Write AuditLog
        try {
            const AuditLog = (await import('../models/AuditLog.js')).default;
            const actor = await User.findById(req.user.userId);
            await AuditLog.create({
                actorId: new mongoose.Types.ObjectId(req.user.userId),
                actorName: actor?.name || 'Inventory Manager',
                actionType: 'order_status_change',
                targetEntityType: 'Order',
                targetEntityId: order._id,
                changeDelta: { before: { status: prevStatus }, after: { status } },
            });
        }
        catch (auditErr) {
            console.error('Failed to write audit log for order status change:', auditErr.message);
        }
        // Refunds additionally get their own dedicated audit entry carrying the
        // money-movement details (who approved, why, Stripe refund id)
        if (status === 'refunded' && order.refund) {
            try {
                const AuditLog = (await import('../models/AuditLog.js')).default;
                const actor = await User.findById(req.user.userId);
                await AuditLog.create({
                    actorId: new mongoose.Types.ObjectId(req.user.userId),
                    actorName: actor?.name || 'Inventory Manager',
                    actionType: 'refund_decision',
                    targetEntityType: 'Order',
                    targetEntityId: order._id,
                    changeDelta: {
                        before: { refund: null },
                        after: {
                            refund: {
                                status: order.refund.status,
                                reason: order.refund.reason,
                                stripeRefundId: order.refund.stripeRefundId,
                            },
                        },
                    },
                });
            }
            catch (auditErr) {
                console.error('Failed to write refund_decision audit log:', auditErr.message);
            }
        }
        // In-app notification for the order owner (bell in the storefront header)
        try {
            const Notification = (await import('../models/Notification.js')).default;
            const titles = {
                confirmed: `Order ${order.orderNumber} confirmed ✓`,
                processing: `Order ${order.orderNumber} is being processed`,
                shipped: `Order ${order.orderNumber} has shipped 📦`,
                delivered: `Order ${order.orderNumber} was delivered 🎉`,
                cancelled: `Order ${order.orderNumber} was cancelled`,
                refunded: `Order ${order.orderNumber} was refunded`,
            };
            const messages = {
                confirmed: 'Your order has been confirmed and will be prepared for shipping.',
                processing: 'Your order is being prepared.',
                shipped: 'Your order is on its way.',
                delivered: 'Your order has been delivered. Enjoy!',
                cancelled: `Your order was cancelled. Reason: ${reason}`,
                refunded: `Your order was refunded. Reason: ${reason}`,
            };
            await Notification.create({
                userId: order.userId,
                orderId: order._id,
                title: titles[status] || `Order ${order.orderNumber} updated`,
                message: messages[status] || `Status changed to ${status}.`,
            });
        }
        catch (notifyErr) {
            console.error('Failed to create order notification:', notifyErr.message);
        }
        // Fire status-change email (non-blocking) — includes the reason if any
        try {
            const buyer = await User.findById(order.userId);
            if (buyer && ['confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'].includes(status)) {
                sendOrderStatusChangeEmail(buyer.email, order.orderNumber, status, status === 'cancelled' || status === 'refunded' ? reason : undefined);
            }
        }
        catch (mailErr) {
            console.error('Failed to send status change email:', mailErr.message);
        }
        res.status(200).json({
            success: true,
            data: order,
        });
    }
    catch (error) {
        next(error);
    }
};
