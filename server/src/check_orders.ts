import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/Order.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/opticart';

async function checkOrders() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  try {
    const orders = await Order.find({});
    console.log(`\nFound ${orders.length} total orders in database.`);
    
    for (const order of orders) {
      console.log(`- Order Number: ${order.orderNumber}`);
      console.log(`  ID: ${order._id}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Payment Status: ${order.paymentStatus}`);
      console.log(`  Items Count: ${order.items?.length}`);
      console.log(`  Total: $${(order.totalCents / 100).toFixed(2)}`);
      console.log(`  Payment Intent ID: ${order.paymentIntentId}`);
      console.log('--------------------------------------------------');
    }
  } catch (error: any) {
    console.error('Error fetching orders:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

checkOrders();
