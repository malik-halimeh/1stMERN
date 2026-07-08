import User from '../models/User.js';

export const sendOrderConfirmationEmail = (email: string, orderNumber: string, totalAmount: number) => {
  console.log('========================================================================');
  console.log(`✉️  EMAIL DISPATCHED: Order Confirmation`);
  console.log(`To: ${email}`);
  console.log(`Subject: Your OptiCart order is confirmed! - ${orderNumber}`);
  console.log(`Body: Thank you for shopping with OptiCart! Total Paid: $${(totalAmount / 100).toFixed(2)}.`);
  console.log('========================================================================');
};

export const sendOrderStatusChangeEmail = (email: string, orderNumber: string, status: string) => {
  console.log('========================================================================');
  console.log(`✉️  EMAIL DISPATCHED: Order Status Update`);
  console.log(`To: ${email}`);
  console.log(`Subject: Your OptiCart order status has changed: ${status.toUpperCase()} - ${orderNumber}`);
  console.log(`Body: Your order is now marked as ${status}. You can trace tracking details in your profile.`);
  console.log('========================================================================');
};

export const sendLowStockAlertEmail = async (sku: string, currentStock: number) => {
  try {
    // Notify all inventory managers
    const managers = await User.find({ role: 'inventory_manager', isActive: true });
    const emails = managers.map((m) => m.email);

    if (emails.length === 0) {
      console.log(`⚠️  Mailer: No active inventory managers found to notify for low stock warning on SKU ${sku}.`);
      return;
    }

    console.log('========================================================================');
    console.log(`✉️  EMAIL DISPATCHED: Low Stock Warning (Restock Needed)`);
    console.log(`To: ${emails.join(', ')}`);
    console.log(`Subject: WARNING: Low Stock Triggered on SKU ${sku}`);
    console.log(`Body: Variant SKU "${sku}" stock level has dropped to ${currentStock}. Please issue restocks.`);
    console.log('========================================================================');
  } catch (err: any) {
    console.error('Failed to dispatch low stock emails:', err.message);
  }
};
