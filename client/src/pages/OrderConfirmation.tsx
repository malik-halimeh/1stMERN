import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, ArrowRight, Truck } from 'lucide-react';
import StorefrontLayout from '../components/layout/StorefrontLayout.js';
import Button from '../components/ui/Button.js';
import Skeleton from '../components/ui/Skeleton.js';
import { useToast } from '../context/ToastContext.js';
import { useShop } from '../context/ShopContext.js';
import api from '../services/api.js';

interface OrderItem {
  productId: string;
  name: string;
  variantSku: string;
  unitPriceCents: number;
  quantity: number;
}

interface OrderData {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    country: string;
  };
  status: string;
  createdAt: string;
}

const OrderConfirmation: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { refreshShopData } = useShop();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/orders/${id}`);
        if (res.data?.success) {
          setOrder(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load order:', err);
        addToast('Failed to load order receipt information.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchOrderDetails();
    // Checkout emptied the server cart — resync the header badge
    refreshShopData();
  }, [id]);

  // Static delivery window calculation (e.g. orderDate + 4 business days)
  const getDeliveryEstimate = () => {
    if (!order) return '';
    const date = new Date(order.createdAt);
    date.setDate(date.getDate() + 3);
    const startStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    date.setDate(date.getDate() + 2);
    const endStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  return (
    <StorefrontLayout breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Order Confirmation' }]}>
      <div className="max-w-3xl mx-auto px-4 py-10 font-sans">
        {isLoading ? (
          <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1 space-y-4">
            <Skeleton variant="circle" className="h-16 w-16 mx-auto" />
            <Skeleton variant="text" className="h-6 w-48 mx-auto" />
            <Skeleton variant="rect" className="h-40 w-full" />
          </div>
        ) : !order ? (
          <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-10 shadow-level1 text-center space-y-4">
            <span className="text-danger text-4xl">⚠️</span>
            <h2 className="text-lg font-bold text-text-primary">Receipt Not Found</h2>
            <p className="text-xs text-text-secondary">We could not pull the invoice details for order ID: {id}</p>
            <Button onClick={() => navigate('/products')} variant="primary" className="px-6 py-2 text-xs">
              Go to Store
            </Button>
          </div>
        ) : (
          <div className="space-y-6 text-left">
            {/* Header Success block */}
            <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-8 shadow-level1 text-center space-y-4">
              <div className="inline-flex p-3 bg-success-bg/15 rounded-full text-success justify-center items-center">
                <CheckCircle2 className="h-12 w-12" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary">Thank You for Your Order!</h1>
                <p className="text-sm text-text-secondary mt-1">
                  Your payment was captured and your transaction reference is code <span className="font-mono font-bold text-primary-dark">{order.orderNumber}</span>.
                </p>
              </div>

              {/* Delivery Window banner */}
              <div className="bg-dashboard-section-bg/40 border border-dashboard-section-bg p-4 rounded-lg inline-flex items-center gap-3 text-left w-full sm:w-auto">
                <Truck className="h-5 w-5 text-primary" />
                <div className="text-xs">
                  <span className="font-bold text-text-primary block">Estimated Delivery Window</span>
                  <span className="text-text-secondary font-medium">{getDeliveryEstimate()} (Standard Free Shipping)</span>
                </div>
              </div>
            </div>

            {/* Itemized summary receipt */}
            <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1 space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-dashboard-section-bg pb-3">
                Items Purchased
              </h3>

              <div className="divide-y divide-dashboard-section-bg">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-4 first:pt-0 last:pb-0 text-sm">
                    <div>
                      <span className="font-bold text-text-primary block">{item.name}</span>
                      <span className="text-xs text-text-muted font-mono block mt-0.5">SKU: {item.variantSku}</span>
                      <span className="text-xs text-text-secondary block mt-0.5">Qty: {item.quantity}</span>
                    </div>
                    <div className="text-right font-semibold text-text-primary">
                      ${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Order total lines */}
              <div className="border-t border-dashboard-section-bg pt-4 space-y-2 text-xs text-text-secondary">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${(order.subtotalCents / 100).toFixed(2)}</span>
                </div>
                {order.discountCents > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Discount Code Applied</span>
                    <span>-${(order.discountCents / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="text-success font-medium">Free</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-text-primary border-t border-dashboard-section-bg pt-3">
                  <span>Total Paid</span>
                  <span className="text-primary-dark">${(order.totalCents / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Shipping Address snapshot */}
            <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1 text-xs text-left">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-dashboard-section-bg pb-3 mb-3">
                Delivery Destination
              </h3>
              <p className="font-semibold text-text-primary">Shipping To Address:</p>
              <p className="text-text-secondary mt-1">{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 && <p className="text-text-secondary">{order.shippingAddress.line2}</p>}
              <p className="text-text-secondary">{order.shippingAddress.city}, {order.shippingAddress.country}</p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={() => navigate('/account')}
                variant="primary"
                className="flex-grow py-3 font-bold text-sm flex justify-center items-center gap-2"
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Track Order Status
              </Button>
              <Button
                onClick={() => navigate('/products')}
                variant="secondary"
                className="flex-grow sm:flex-grow-0 py-3 px-6 font-bold text-sm flex justify-center items-center gap-2"
                icon={<ShoppingBag className="h-4 w-4" />}
              >
                Continue Shopping
              </Button>
            </div>
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
};

export default OrderConfirmation;
