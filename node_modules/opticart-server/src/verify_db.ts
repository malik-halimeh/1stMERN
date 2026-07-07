import dotenv from 'dotenv';
import connectDB from './config/db.js';
import mongoose from 'mongoose';

// Load models to register them with mongoose
import { User } from './models/User.js';
import { Category } from './models/Category.js';
import { Product } from './models/Product.js';
import { Cart } from './models/Cart.js';
import { Wishlist } from './models/Wishlist.js';
import { Coupon } from './models/Coupon.js';
import { Order } from './models/Order.js';
import { Review } from './models/Review.js';
import { LowStockAlert } from './models/LowStockAlert.js';
import { AuditLog } from './models/AuditLog.js';
import { ProductEvent } from './models/ProductEvent.js';
import { ProductRecommendation } from './models/ProductRecommendation.js';

dotenv.config();

const modelsList = [
  { name: 'User', model: User },
  { name: 'Category', model: Category },
  { name: 'Product', model: Product },
  { name: 'Cart', model: Cart },
  { name: 'Wishlist', model: Wishlist },
  { name: 'Coupon', model: Coupon },
  { name: 'Order', model: Order },
  { name: 'Review', model: Review },
  { name: 'LowStockAlert', model: LowStockAlert },
  { name: 'AuditLog', model: AuditLog },
  { name: 'ProductEvent', model: ProductEvent },
  { name: 'ProductRecommendation', model: ProductRecommendation },
];

async function runIndexVerification() {
  console.log('--- OptiCart Database Index Verification Smoke Test ---');
  
  // Connect to DB
  await connectDB();

  console.log('\nSynchronizing indexes for registered schemas...');
  for (const item of modelsList) {
    try {
      // Sync indexes pushes index declarations to MongoDB
      await item.model.syncIndexes();
      console.log(`✓ Synchronized indexes for: ${item.name}`);
    } catch (err) {
      console.error(`✗ Error synchronizing index for ${item.name}:`, err);
    }
  }

  console.log('\nRetrieving and verifying defined indexes...');
  for (const item of modelsList) {
    console.log(`\n================== ${item.name} Indexes ==================`);
    try {
      const indexes = await item.model.listIndexes();
      console.log(JSON.stringify(indexes, null, 2));
    } catch (err) {
      console.error(`✗ Error listing indexes for ${item.name}:`, err);
    }
  }

  console.log('\nDatabase index verification complete. Disconnecting...');
  await mongoose.disconnect();
  console.log('Mongoose disconnected. Verification script exiting.');
  process.exit(0);
}

runIndexVerification().catch(async (err) => {
  console.error('Fatal error during database index verification:', err);
  await mongoose.disconnect();
  process.exit(1);
});
