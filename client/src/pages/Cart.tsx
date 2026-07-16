import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trash2, Plus, Minus, Ticket, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';
import StorefrontLayout from '../components/layout/StorefrontLayout.js';
import Button from '../components/ui/Button.js';
import Input from '../components/ui/Input.js';
import EmptyState from '../components/ui/EmptyState.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { useShop } from '../context/ShopContext.js';
import api from '../services/api.js';
import { getApiErrorMessage } from '../utils/apiError.js';
import { isUsableImageUrl } from '../utils/productImage.js';
import { getGuestCartItems, setGuestCartItems } from '../utils/guestCart.js';

// Shape returned by GET /cart — flattened, validated items
interface ApiCartItem {
  productId: string;
  productName?: string;
  brand?: string;
  slug?: string;
  image?: string;
  variantSku: string;
  color?: string;
  capacity?: string;
  quantity: number;
  priceAtAddCents?: number;
  currentPriceCents?: number;
  availableStock?: number;
}

interface CartItem {
  productId: string;
  variantSku: string;
  quantity: number;
  name: string;
  brand?: string;
  slug: string;
  thumbnail: string;
  basePriceCents: number;
  priceDeltaCents: number;
  stock: number;
  color?: string;
  capacity?: string;
}

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { setCartCount } = useShop();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Keep the header badge in sync with whatever this page shows/mutates
  const syncBadge = (items: CartItem[]) => {
    setCartCount(items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0));
  };

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    discountCents: number;
  } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Fetch cart items
  const fetchCart = async () => {
    try {
      setIsLoading(true);
      if (user) {
        // Authenticated cart from server
        const res = await api.get('/cart');
        if (res.data?.success) {
          const items = res.data.data.items.map((item: ApiCartItem) => ({
            productId: String(item.productId),
            variantSku: item.variantSku,
            quantity: item.quantity,
            name: item.productName || 'Unknown Product',
            brand: item.brand,
            slug: item.slug || '',
            thumbnail: item.image || '',
            // Server sends the live variant price pre-computed
            basePriceCents: item.currentPriceCents ?? item.priceAtAddCents ?? 0,
            priceDeltaCents: 0,
            stock: typeof item.availableStock === 'number' ? item.availableStock : 0,
            color: item.color,
            capacity: item.capacity,
          }));
          setCartItems(items);
          syncBadge(items);
        }
      } else {
        // Guest cart from localStorage
        const guestItems = getGuestCartItems();
        setCartItems(guestItems);
        syncBadge(guestItems);
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
      addToast('Could not sync shopping cart.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [user]);

  // Handle quantity adjustments
  const handleQuantityChange = async (index: number, newQty: number) => {
    const item = cartItems[index];
    if (newQty < 1) return;

    if (user) {
      try {
        const res = await api.patch(`/cart/items/${item.productId}`, {
          variantSku: item.variantSku,
          quantity: newQty,
        });
        if (res.data?.success) {
          const updatedItems = [...cartItems];
          updatedItems[index].quantity = newQty;
          setCartItems(updatedItems);
          syncBadge(updatedItems);
          addToast('Cart updated.', 'success');
        }
      } catch (err) {
        addToast(getApiErrorMessage(err, 'Failed to update item quantity.'), 'error');
      }
    } else {
      // Guest cart local update
      const updatedItems = [...cartItems];
      updatedItems[index].quantity = newQty;
      setCartItems(updatedItems);
      syncBadge(updatedItems);
      setGuestCartItems(updatedItems);
      addToast('Cart updated.', 'success');
    }
  };

  // Remove cart item
  const handleRemoveItem = async (index: number) => {
    const item = cartItems[index];
    if (user) {
      try {
        const res = await api.delete(`/cart/items/${item.productId}`, {
          data: { variantSku: item.variantSku },
        });
        if (res.data?.success) {
          const updatedItems = cartItems.filter((_, idx) => idx !== index);
          setCartItems(updatedItems);
          syncBadge(updatedItems);
          addToast('Item removed from cart.', 'success');
        }
      } catch {
        addToast('Failed to remove cart item.', 'error');
      }
    } else {
      // Guest cart remove
      const updatedItems = cartItems.filter((_, idx) => idx !== index);
      setCartItems(updatedItems);
      syncBadge(updatedItems);
      setGuestCartItems(updatedItems);
      addToast('Item removed from cart.', 'success');
    }
  };

  // Calculate order subtotals
  const getSubtotal = () => {
    return cartItems.reduce((acc, item) => {
      const price = item.basePriceCents + item.priceDeltaCents;
      return acc + price * item.quantity;
    }, 0);
  };

  const subtotalCents = getSubtotal();
  const discountCents = appliedCoupon ? appliedCoupon.discountCents : 0;
  const totalCents = Math.max(0, subtotalCents - discountCents);

  // Apply Coupon Code
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    if (!user) {
      addToast('Please login to apply coupon codes.', 'warning');
      return;
    }

    try {
      setIsApplyingCoupon(true);
      const res = await api.post('/coupons/apply', {
        code: couponCode.toUpperCase().trim(),
        cartSubtotalCents: subtotalCents,
      });

      if (res.data?.success) {
        const coupon = res.data.data;
        setAppliedCoupon({
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          discountCents: coupon.discountCents,
        });
        // Persist so Checkout can forward the code to the order (backend
        // re-validates it in full — this only carries the code across pages).
        localStorage.setItem('applied_coupon_code', coupon.code);
        addToast(`Coupon "${coupon.code}" successfully applied!`, 'success');
      }
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Invalid or expired coupon code.'), 'error');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    localStorage.removeItem('applied_coupon_code');
    addToast('Coupon code removed.', 'info');
  };

  // Re-verify coupon discount value if items count shifts
  useEffect(() => {
    if (appliedCoupon && user) {
      const reVerifyCoupon = async () => {
        try {
          const res = await api.post('/coupons/apply', {
            code: appliedCoupon.code,
            cartSubtotalCents: subtotalCents,
          });
          if (res.data?.success) {
            setAppliedCoupon({
              ...appliedCoupon,
              discountCents: res.data.data.discountCents,
            });
          }
        } catch {
          // If min value limit fails, strip coupon
          setAppliedCoupon(null);
          localStorage.removeItem('applied_coupon_code');
          addToast('Coupon removed because cart subtotal fell below limit.', 'warning');
        }
      };
      reVerifyCoupon();
    }
  }, [subtotalCents]);

  // Check if any cart items are out of stock or exceed stock
  const hasStockErrors = cartItems.some((item) => item.stock === 0 || item.quantity > item.stock);

  const handleProceedToCheckout = () => {
    if (hasStockErrors) {
      addToast('Please fix stock availability errors before checking out.', 'error');
      return;
    }

    if (!user) {
      // Store current redirect param
      navigate('/login?redirect=/checkout');
    } else {
      navigate('/checkout');
    }
  };

  return (
    <StorefrontLayout breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Shopping Cart' }]}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
        <h1 className="text-3xl font-bold text-text-primary text-left mb-8">Shopping Cart</h1>

        {isLoading ? (
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex-grow space-y-4">
              <div className="h-28 bg-dashboard-section-bg/50 rounded-card animate-pulse" />
              <div className="h-28 bg-dashboard-section-bg/50 rounded-card animate-pulse" />
            </div>
            <div className="w-full lg:w-96 h-80 bg-dashboard-section-bg/50 rounded-card animate-pulse" />
          </div>
        ) : cartItems.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={<ShoppingBag className="h-12 w-12 text-text-secondary" />}
              title="Your Shopping Cart is Empty"
              description="Explore our high-performance refrigerators, quiet dishwashers, and smart ovens to start filling it up."
              actionLabel="Start Shopping"
              onAction={() => navigate('/products')}
            />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Cart Items List */}
            <div className="flex-grow w-full space-y-4">
              {cartItems.map((item, index) => {
                const itemPrice = item.basePriceCents + item.priceDeltaCents;
                const isOutOfStock = item.stock === 0;
                const isStockExceeded = item.quantity > item.stock;

                return (
                  <div
                    key={`${item.productId}-${item.variantSku}`}
                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-surface border rounded-card shadow-level1 transition-all ${
                      isOutOfStock || isStockExceeded ? 'border-danger/30 bg-danger-bg/5' : 'border-dashboard-section-bg/50 hover:shadow-level2'
                    }`}
                  >
                    {/* Item Details */}
                    <div className="flex items-center gap-4 flex-grow text-left">
                      <div className="h-20 w-20 flex-shrink-0 bg-dashboard-section-bg rounded-lg flex items-center justify-center text-3xl border border-dashboard-section-bg/30 overflow-hidden">
                        {isUsableImageUrl(item.thumbnail) ? (
                          <img src={item.thumbnail} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          '🧊'
                        )}
                      </div>
                      <div>
                        {item.brand && (
                          <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">{item.brand}</span>
                        )}
                        <Link to={`/products/${item.slug}`} className="block text-sm font-bold text-text-primary hover:text-primary transition-colors">
                          {item.name}
                        </Link>
                        {/* Variant details */}
                        <div className="flex gap-2 flex-wrap items-center mt-1 text-xs text-text-secondary">
                          {item.color && (
                            <span className="bg-dashboard-section-bg/50 px-2 py-0.5 rounded-full font-medium">
                              Color: {item.color}
                            </span>
                          )}
                          {item.capacity && (
                            <span className="bg-dashboard-section-bg/50 px-2 py-0.5 rounded-full font-medium">
                              Capacity: {item.capacity}
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-text-muted">SKU: {item.variantSku}</span>
                        </div>

                        {/* Stock Warn alert */}
                        {isOutOfStock ? (
                          <span className="text-danger text-xs font-semibold flex items-center gap-1 mt-2 animate-pulse">
                            <AlertCircle className="h-3.5 w-3.5" /> Out of stock
                          </span>
                        ) : isStockExceeded ? (
                          <span className="text-warning text-xs font-semibold flex items-center gap-1 mt-2">
                            <AlertCircle className="h-3.5 w-3.5" /> Exceeds stock limit (Only {item.stock} left)
                          </span>
                        ) : (
                          <span className="text-success text-xs font-medium flex items-center gap-1 mt-2">
                            ✓ In Stock
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stepper & Line subtotals */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-6 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-dashboard-section-bg/30 flex-wrap">
                      {/* Price per unit */}
                      <div className="text-right sm:min-w-[80px]">
                        <span className="text-xs text-text-muted block">Unit Price</span>
                        <span className="text-sm font-semibold text-text-primary">${(itemPrice / 100).toFixed(2)}</span>
                      </div>

                      {/* Quantity selector */}
                      <div className="flex items-center bg-dashboard-section-bg p-1 rounded-btn">
                        <button
                          onClick={() => handleQuantityChange(index, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="p-1 rounded-full text-text-muted hover:text-text-primary hover:bg-white disabled:opacity-30 transition-all focus:outline-none"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-text-primary">{item.quantity}</span>
                        <button
                          onClick={() => handleQuantityChange(index, item.quantity + 1)}
                          disabled={item.quantity >= item.stock}
                          className="p-1 rounded-full text-text-muted hover:text-text-primary hover:bg-white disabled:opacity-30 transition-all focus:outline-none"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Total line price */}
                      <div className="text-right sm:min-w-[90px]">
                        <span className="text-xs text-text-muted block">Subtotal</span>
                        <span className="text-sm font-bold text-primary-dark">
                          ${((itemPrice * item.quantity) / 100).toFixed(2)}
                        </span>
                      </div>

                      {/* Trash action */}
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 text-text-muted hover:text-danger hover:bg-danger-bg/20 rounded-btn transition-colors focus:outline-none"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Sidebar Card */}
            <div className="w-full lg:w-96 flex-shrink-0 lg:sticky lg:top-24">
              <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1 flex flex-col gap-5 text-left">
                <h3 className="text-lg font-bold text-text-primary uppercase tracking-wider border-b border-dashboard-section-bg pb-3">
                  Order Summary
                </h3>

                {/* Subtotals detail */}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-text-secondary">
                    <span>Items Subtotal</span>
                    <span>${(subtotalCents / 100).toFixed(2)}</span>
                  </div>

                  {appliedCoupon && (
                    <div className="flex justify-between text-success font-medium">
                      <div className="flex items-center gap-1.5">
                        <Ticket className="h-4 w-4" />
                        <span>Discount ({appliedCoupon.code})</span>
                      </div>
                      <span>-${(appliedCoupon.discountCents / 100).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-text-secondary">
                    <span>Shipping</span>
                    <span className="text-success font-medium">Free</span>
                  </div>

                  <div className="border-t border-dashboard-section-bg pt-3 flex justify-between font-bold text-base text-text-primary">
                    <span>Estimated Total</span>
                    <span className="text-primary-dark">${(totalCents / 100).toFixed(2)}</span>
                  </div>
                </div>

                {/* Coupon promo codes form */}
                {user && (
                  <form onSubmit={handleApplyCoupon} className="pt-3 border-t border-dashboard-section-bg">
                    <span className="text-xs font-semibold text-text-secondary block mb-2">Have a Promo Coupon?</span>
                    {!appliedCoupon ? (
                      <div className="flex gap-2">
                        <Input
                          id="coupon-input"
                          type="text"
                          placeholder="ENTER CODE"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          className="py-1 px-3 uppercase font-mono text-sm border-text-disabled"
                        />
                        <Button
                          type="submit"
                          variant="secondary"
                          isLoading={isApplyingCoupon}
                          className="px-4 text-xs shrink-0"
                        >
                          Apply
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-success-bg/10 border border-success/20 p-2.5 rounded-lg flex items-center justify-between text-xs">
                        <span className="font-bold text-success font-mono uppercase tracking-wider">{appliedCoupon.code}</span>
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          className="text-text-muted hover:text-danger font-semibold hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </form>
                )}

                {/* Main Action proceeding button */}
                <Button
                  onClick={handleProceedToCheckout}
                  variant="primary"
                  disabled={hasStockErrors}
                  className="w-full mt-2 font-bold py-3 text-sm flex justify-center items-center gap-2"
                  icon={<ArrowRight className="h-4 w-4" />}
                >
                  Proceed to Checkout
                </Button>

                {hasStockErrors && (
                  <div className="flex items-start gap-2 bg-danger-bg/10 border border-danger/20 p-3 rounded-lg text-xs text-danger">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>Please resolve the items highlighted in red before placing an order. Some variants are out of stock.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
};

export default Cart;
