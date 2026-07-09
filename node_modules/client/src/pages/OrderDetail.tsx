import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ClipboardList, Star, ShieldCheck, MapPin, Truck, ChevronRight, MessageSquare } from 'lucide-react';
import StorefrontLayout from '../components/layout/StorefrontLayout.js';
import Button from '../components/ui/Button.js';
import Input from '../components/ui/Input.js';
import Skeleton from '../components/ui/Skeleton.js';
import Modal from '../components/ui/Modal.js';
import { useToast } from '../context/ToastContext.js';
import api from '../services/api.js';

interface OrderItem {
  productId: string;
  name: string;
  variantSku: string;
  unitPriceCents: number;
  quantity: number;
}

interface OrderDetails {
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
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  createdAt: string;
}

const OrderDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Review Modal state
  const [selectedProductReview, setSelectedProductReview] = useState<{ productId: string; name: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/orders/${id}`);
        if (res.data?.success) {
          setOrder(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load order detail:', err);
        addToast('Failed to pull order status updates.', 'error');
        navigate('/account');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchOrder();
  }, [id]);

  // Stepper steps configuration
  const normalSteps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  const getCurrentStepIndex = () => {
    if (!order) return -1;
    if (order.status === 'cancelled' || order.status === 'refunded') return -1;
    return normalSteps.indexOf(order.status);
  };

  const currentStepIdx = getCurrentStepIndex();

  const handleOpenReviewModal = (productId: string, name: string) => {
    setSelectedProductReview({ productId, name });
    setReviewRating(5);
    setReviewComment('');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductReview) return;
    if (!reviewComment.trim()) {
      addToast('Please provide a comment.', 'error');
      return;
    }

    try {
      setIsSubmittingReview(true);
      const res = await api.post('/reviews', {
        productId: selectedProductReview.productId,
        rating: reviewRating,
        text: reviewComment.trim(),
      });

      if (res.data?.success) {
        addToast('Review submitted successfully!', 'success');
        setSelectedProductReview(null);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to submit review. Purchases validation required.';
      addToast(msg, 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <StorefrontLayout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Account', path: '/account' }, { label: 'Order Tracking' }]}>
      <div className="max-w-4xl mx-auto px-4 py-8 font-sans">
        
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton variant="rect" className="h-12 w-full" />
            <Skeleton variant="rect" className="h-28 w-full" />
            <Skeleton variant="rect" className="h-64 w-full" />
          </div>
        ) : !order ? (
          <div className="bg-surface border p-12 text-center rounded-card">
            <span className="text-danger text-4xl">⚠️</span>
            <p className="text-sm text-text-secondary mt-2">Order records could not be found.</p>
          </div>
        ) : (
          <div className="space-y-6 text-left">
            
            {/* Header section info */}
            <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Transaction Invoice</span>
                <h1 className="text-xl font-bold text-text-primary mt-0.5">{order.orderNumber}</h1>
                <span className="text-xs text-text-secondary block mt-1">
                  Placed on {new Date(order.createdAt).toLocaleString()}
                </span>
              </div>
              <div>
                {order.status === 'cancelled' && (
                  <span className="bg-danger-bg/20 border border-danger/30 text-danger px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                    Cancelled
                  </span>
                )}
                {order.status === 'refunded' && (
                  <span className="bg-amber-100 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                    Refunded
                  </span>
                )}
                {order.status !== 'cancelled' && order.status !== 'refunded' && (
                  <span className="bg-primary-bg/25 border border-primary/20 text-primary-dark px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                    Status: {order.status}
                  </span>
                )}
              </div>
            </div>

            {/* Stepper Progress component */}
            {order.status !== 'cancelled' && order.status !== 'refunded' && (
              <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-8">
                  Shipping Status Stepper
                </h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 sm:gap-4 relative">
                  {/* Stepper line */}
                  <div className="absolute left-[15px] sm:left-4 sm:right-4 top-4 bottom-4 sm:bottom-auto sm:h-0.5 w-0.5 sm:w-auto bg-dashboard-section-bg -z-10" />
                  
                  {normalSteps.map((stepName, index) => {
                    const isCompleted = index <= currentStepIdx;
                    const isActive = index === currentStepIdx;

                    return (
                      <div key={stepName} className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2 flex-grow select-none">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all ${
                          isCompleted
                            ? 'bg-primary-dark border-primary-dark text-white'
                            : 'bg-surface border-text-disabled text-text-muted'
                        } ${isActive ? 'ring-4 ring-primary/20 animate-scale-in' : ''}`}>
                          {index + 1}
                        </div>
                        <div className="text-left sm:text-center">
                          <span className={`text-xs font-bold capitalize block ${
                            isCompleted ? 'text-text-primary' : 'text-text-muted'
                          }`}>{stepName}</span>
                          <span className="text-[10px] text-text-muted">
                            {isActive ? 'Current status' : isCompleted ? 'Completed' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Snapshot itemized listings */}
            <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1 space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-dashboard-section-bg pb-3">
                Order Items
              </h3>
              <div className="divide-y divide-dashboard-section-bg">
                {order.items.map((item) => (
                  <div key={item.variantSku} className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 first:pt-0 last:pb-0 gap-4">
                    <div className="text-left">
                      <span className="font-bold text-text-primary text-sm block">{item.name}</span>
                      <span className="text-xs text-text-secondary font-mono block mt-0.5">SKU: {item.variantSku}</span>
                      <span className="text-xs text-text-muted block mt-0.5">Quantity: {item.quantity}</span>
                    </div>
                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-dashboard-section-bg/30 pt-3 sm:pt-0">
                      <span className="font-bold text-primary-dark text-sm">
                        ${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}
                      </span>
                      {order.status === 'delivered' && (
                        <Button
                          onClick={() => handleOpenReviewModal(item.productId, item.name)}
                          variant="secondary"
                          className="py-1 px-3 text-[10px]"
                          icon={<MessageSquare className="h-3 w-3" />}
                        >
                          Write a Review
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary line total items */}
              <div className="border-t border-dashboard-section-bg pt-4 space-y-2 text-xs text-text-secondary">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${(order.subtotalCents / 100).toFixed(2)}</span>
                </div>
                {order.discountCents > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Coupon discount</span>
                    <span>-${(order.discountCents / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-text-primary border-t border-dashboard-section-bg pt-2 text-sm">
                  <span>Total Invoiced</span>
                  <span>${(order.totalCents / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Shipping Address Recap */}
            <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1 flex items-start gap-3">
              <MapPin className="h-5 w-5 text-text-muted mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-text-primary block mb-1">Destination Address</span>
                <span className="text-text-secondary block">{order.shippingAddress.line1}</span>
                {order.shippingAddress.line2 && <span className="text-text-secondary block">{order.shippingAddress.line2}</span>}
                <span className="text-text-secondary block">{order.shippingAddress.city}, {order.shippingAddress.country}</span>
              </div>
            </div>

          </div>
        )}

        {/* Inline Review Submitting Modal */}
        {selectedProductReview && (
          <Modal
            isOpen={true}
            onClose={() => setSelectedProductReview(null)}
            title={`Write Review: ${selectedProductReview.name}`}
          >
            <form onSubmit={handleSubmitReview} className="space-y-4 text-left font-sans">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1.5">Rating (1-5 Stars)</label>
                <div className="flex gap-1 text-amber-400">
                  {[1, 2, 3, 4, 5].map((stars) => (
                    <button
                      key={stars}
                      type="button"
                      onClick={() => setReviewRating(stars)}
                      className="focus:outline-none"
                    >
                      <Star className={`h-6 w-6 ${stars <= reviewRating ? 'fill-current' : 'text-text-disabled'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">Comment</label>
                <textarea
                  className="w-full min-h-[100px] border border-text-disabled rounded-input p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Share your experience using this appliance..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => setSelectedProductReview(null)}
                  className="py-1.5 px-4 text-xs bg-transparent border border-text-disabled hover:bg-dashboard-section-bg/30 text-text-secondary"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmittingReview}
                  className="py-1.5 px-5 text-xs font-bold"
                >
                  Submit Review
                </Button>
              </div>
            </form>
          </Modal>
        )}

      </div>
    </StorefrontLayout>
  );
};

export default OrderDetail;
