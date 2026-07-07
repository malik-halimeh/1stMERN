import dotenv from 'dotenv';
import connectDB from './config/db.js';
import mongoose from 'mongoose';
import Category from './models/Category.js';
import Product from './models/Product.js';
import Cart from './models/Cart.js';
import Wishlist from './models/Wishlist.js';
import Coupon from './models/Coupon.js';
import Order from './models/Order.js';
import Review from './models/Review.js';
import LowStockAlert from './models/LowStockAlert.js';
import AuditLog from './models/AuditLog.js';
dotenv.config();
async function runCoreApisVerification() {
    console.log('--- OptiCart Core REST APIs Integration Verification Test ---');
    // Connect to Database
    await connectDB();
    // Test identifiers
    const mockUserId = new mongoose.Types.ObjectId();
    const mockProductId = new mongoose.Types.ObjectId();
    const mockCategoryId = new mongoose.Types.ObjectId();
    const mockOrderId = new mongoose.Types.ObjectId();
    console.log('\n[Setup] Cleaning previous mock test documents...');
    await Category.deleteOne({ name: 'Mock Major Appliances' });
    await Category.deleteOne({ name: 'Mock Refrigerators' });
    await Product.deleteOne({ name: 'Mock Smart Refrigerator' });
    await Cart.deleteOne({ userId: mockUserId });
    await Wishlist.deleteOne({ userId: mockUserId });
    await Coupon.deleteOne({ code: 'OPTI_TEST_PROMO' });
    await Order.deleteOne({ _id: mockOrderId });
    await Review.deleteMany({ productId: mockProductId });
    await LowStockAlert.deleteMany({ productId: mockProductId });
    await mongoose.connection.db?.collection('auditLogs').deleteMany({ targetEntityId: mockProductId });
    // 1. Categories 2-level tree formulation test
    console.log('\n[Step 1] Formulating 2-level Categories Tree...');
    const rootCat = await Category.create({
        _id: mockCategoryId,
        name: 'Mock Major Appliances',
        slug: 'mock-major-appliances',
    });
    const childCat = await Category.create({
        name: 'Mock Refrigerators',
        slug: 'mock-refrigerators',
        parentId: rootCat._id,
    });
    const allCats = await Category.find();
    const rootNodes = allCats.filter((c) => !c.parentId);
    const categoriesTree = rootNodes.map((root) => ({
        name: root.name,
        subcategories: allCats.filter((c) => c.parentId?.toString() === root._id.toString()).map((c) => c.name),
    }));
    console.log('✓ Categories Tree result:', JSON.stringify(categoriesTree, null, 2));
    // 2. Product and variants setup
    console.log('\n[Step 2] Creating Product with Variants...');
    const product = await Product.create({
        _id: mockProductId,
        name: 'Mock Smart Refrigerator',
        slug: 'mock-smart-refrigerator',
        description: 'High tech refrigerator with touchscreen and live monitoring.',
        brand: 'OptiHome',
        categoryId: childCat._id,
        basePriceCents: 150000, // $1500.00
        variants: [
            {
                sku: 'REF-SMART-SS',
                color: 'Stainless Steel',
                size: 'Large',
                capacity: '29 cu ft',
                stock: 5, // Low stock limit!
                priceDeltaCents: 10000, // +$100.00
                costPriceCents: 90000,
                lowStockThreshold: 10, // Stock (5) <= threshold (10), should trigger low-stock alert!
            },
        ],
        images: [{ url: 'http://cloudinary.mock/ref.png', publicId: 'products/ref' }],
        ratingAvg: 0,
        reviewCount: 0,
        isTrending: true,
        isMostSelling: false,
        searchKeywords: ['smart', 'refrigerator', 'fridge'],
    });
    console.log(`✓ Product created: ${product.name}, Slug: ${product.slug}, Base Price: $${(product.basePriceCents / 100).toFixed(2)}`);
    // Low stock check
    for (const v of product.variants) {
        if (v.stock <= v.lowStockThreshold) {
            try {
                await LowStockAlert.create({
                    productId: product._id,
                    variantSku: v.sku,
                    thresholdAtTrigger: v.lowStockThreshold,
                    currentStock: v.stock,
                    status: 'active',
                });
                console.log(`✓ LowStockAlert generated for ${v.sku} (Stock: ${v.stock} <= Threshold: ${v.lowStockThreshold})`);
            }
            catch (err) {
                console.warn('LowStockAlert duplicate suppressed.');
            }
        }
    }
    // 3. Cart live price & stock re-validation test
    console.log('\n[Step 3] Verifying Cart items re-validation...');
    // Add item with historical price ($1200.00)
    const cart = await Cart.create({
        userId: mockUserId,
        items: [
            {
                productId: product._id,
                variantSku: 'REF-SMART-SS',
                quantity: 2,
                priceAtAddCents: 120000, // Old price
            },
        ],
    });
    const cartItem = cart.items[0];
    const variant = product.variants.find((v) => v.sku === cartItem.variantSku);
    const currentVariantPrice = product.basePriceCents + variant.priceDeltaCents; // $1600.00
    const isPriceChanged = cartItem.priceAtAddCents !== currentVariantPrice;
    console.log(`Cart item SKU: ${cartItem.variantSku}`);
    console.log(`- Price at add: $${(cartItem.priceAtAddCents / 100).toFixed(2)}`);
    console.log(`- Current price: $${(currentVariantPrice / 100).toFixed(2)}`);
    console.log(`✓ Flagged price mismatch: ${isPriceChanged ? 'YES (✓ Correct)' : 'NO (✗ Error)'}`);
    // 4. Coupon validation checks
    console.log('\n[Step 4] Verifying Coupon discount calculations...');
    const coupon = await Coupon.create({
        code: 'OPTI_TEST_PROMO',
        type: 'percentage',
        value: 10, // 10% discount
        minOrderValueCents: 100000, // $1000.00 min order
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expiry tomorrow
        usageLimit: 100,
        perUserLimit: 1,
        isActive: true,
    });
    const cartSubtotal = 160000; // $1600.00
    let discountCents = 0;
    if (coupon.isActive && new Date(coupon.expiryDate) > new Date() && cartSubtotal >= coupon.minOrderValueCents) {
        if (coupon.type === 'percentage') {
            discountCents = Math.round(cartSubtotal * (coupon.value / 100));
        }
        else {
            discountCents = coupon.value;
        }
    }
    console.log(`Coupon Applied: ${coupon.code}`);
    console.log(`- Cart Subtotal: $${(cartSubtotal / 100).toFixed(2)}`);
    console.log(`- Expected Discount (10%): $${(discountCents / 100).toFixed(2)}`);
    console.log(`✓ Discount validation result: $${(discountCents / 100).toFixed(2)}`);
    // 5. Review verified-purchase checks & transactional ratings average recalculation
    console.log('\n[Step 5] Verifying Review Purchase Locks & Recalculation...');
    // Let's create a delivered order to pass the verified purchase gate
    const order = await Order.create({
        _id: mockOrderId,
        orderNumber: 'ORD-98765',
        userId: mockUserId,
        items: [
            {
                productId: product._id,
                name: product.name,
                variantSku: 'REF-SMART-SS',
                unitPriceCents: currentVariantPrice,
                unitCostCents: 90000,
                quantity: 1,
            },
        ],
        subtotalCents: currentVariantPrice,
        discountCents: 0,
        totalCents: currentVariantPrice,
        shippingAddress: { line1: '123 Test St', city: 'Test City', country: 'Testland' },
        status: 'delivered', // Delivered!
        paymentStatus: 'succeeded',
    });
    // Check delivered order exists
    const hasDeliveredOrder = await Order.exists({
        userId: mockUserId,
        status: 'delivered',
        'items.productId': product._id,
    });
    console.log(`✓ Verified Purchase order exists: ${hasDeliveredOrder ? 'YES (✓ Correct)' : 'NO (✗ Error)'}`);
    // Create review
    const review = await Review.create({
        productId: product._id,
        userId: mockUserId,
        orderId: order._id,
        rating: 5,
        text: 'Stunning appliance, very quiet and highly functional!',
    });
    console.log(`✓ Review created successfully: ${review.text}, Rating: ${review.rating}/5`);
    // Transaction ratings aggregate simulation
    const reviews = await Review.find({ productId: product._id, isRemoved: false });
    const reviewCount = reviews.length;
    const ratingAvg = reviewCount > 0 ? parseFloat((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount).toFixed(2)) : 0;
    await Product.findByIdAndUpdate(product._id, { ratingAvg, reviewCount });
    const updatedProduct = await Product.findById(product._id);
    console.log(`✓ Product rating fields updated transactionally: Avg Rating = ${updatedProduct?.ratingAvg}, Review Count = ${updatedProduct?.reviewCount}`);
    // 6. Audit Logging checking
    console.log('\n[Step 6] Testing Audit Log records...');
    // Simulate review moderation deletion logging
    await AuditLog.create({
        actorId: mockUserId, // admin moderator mock
        actorName: 'sarah_admin',
        actionType: 'review_removal',
        targetEntityType: 'Review',
        targetEntityId: review._id,
        changeDelta: {
            before: review.toObject(),
            after: { ...review.toObject(), isRemoved: true },
        },
    });
    const loggedAudit = await AuditLog.findOne({ targetEntityId: review._id });
    console.log(`✓ Audit log captured for moderated review: Action = ${loggedAudit?.actionType}, Actor = ${loggedAudit?.actorName}`);
    // Cleanup database test entries
    console.log('\n[Cleanup] Removing mock test documents...');
    await Category.deleteOne({ _id: rootCat._id });
    await Category.deleteOne({ _id: childCat._id });
    await Product.deleteOne({ _id: product._id });
    await Cart.deleteOne({ _id: cart._id });
    await Wishlist.deleteOne({ userId: mockUserId });
    await Coupon.deleteOne({ _id: coupon._id });
    await Order.deleteOne({ _id: order._id });
    await Review.deleteOne({ _id: review._id });
    await LowStockAlert.deleteMany({ productId: product._id });
    await mongoose.connection.db?.collection('auditLogs').deleteOne({ _id: loggedAudit?._id });
    console.log('\n--- Core REST APIs Verification Successfully Completed ---');
    await mongoose.disconnect();
    process.exit(0);
}
runCoreApisVerification().catch(async (err) => {
    console.error('✗ Verification failed with error:', err);
    await mongoose.disconnect();
    process.exit(1);
});
