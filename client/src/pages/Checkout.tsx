import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { MapPin, CreditCard, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import StorefrontLayout from '../components/layout/StorefrontLayout.js';
import Button from '../components/ui/Button.js';
import Input from '../components/ui/Input.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import axios from 'axios';
import api from '../services/api.js';
import { getApiErrorMessage } from '../utils/apiError.js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_mock_key');

interface Address {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  country: string;
  isDefault?: boolean;
}

interface CheckoutSessionData {
  clientSecret: string;
  paymentIntentId: string;
  orderId: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

const CheckoutForm: React.FC<{ clientSecret: string; paymentIntentId: string; totalCents: number; onPaymentSuccess: () => void }> = ({
  totalCents,
  onPaymentSuccess,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { addToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/checkout-redirect`,
        },
      });

      if (error) {
        addToast(error.message || 'Payment confirmation failed.', 'error');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        addToast('Payment authorization successful!', 'success');
        onPaymentSuccess();
      } else {
        // Redirecting cases are handled by Stripe redirecting to return_url
        addToast('Payment redirected for verification.', 'info');
      }
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Payment failed.'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        variant="primary"
        isLoading={isProcessing}
        disabled={!stripe || !elements}
        className="w-full py-3 font-bold flex justify-center text-sm"
      >
        Pay ${(totalCents / 100).toFixed(2)} Securely
      </Button>
    </form>
  );
};

const MockPaymentForm: React.FC<{ paymentIntentId: string; totalCents: number; onPaymentSuccess: () => void }> = ({
  paymentIntentId,
  totalCents,
  onPaymentSuccess,
}) => {
  const { addToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('***');

  const handleMockPay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Simulate webhook payment succeeded in background
      await api.post('/orders/webhook', {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
          },
        },
      });
      
      setTimeout(() => {
        addToast('Payment authorized successfully (Mock Sandbox Mode).', 'success');
        onPaymentSuccess();
      }, 1500);
    } catch {
      addToast('Mock checkout failed. Please retry.', 'error');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleMockPay} className="space-y-6 text-left">
      <div className="bg-dashboard-section-bg/30 p-4 rounded-lg border border-dashboard-section-bg flex flex-col gap-3">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">Mock Sandbox Payment</span>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-text-muted">Card Number</label>
          <input
            type="text"
            className="w-full bg-surface border border-text-disabled rounded-input px-3 py-1.5 text-sm font-mono"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-text-muted">Expiry</label>
            <input
              type="text"
              className="w-full bg-surface border border-text-disabled rounded-input px-3 py-1.5 text-sm font-mono"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-text-muted">CVV</label>
            <input
              type="password"
              className="w-full bg-surface border border-text-disabled rounded-input px-3 py-1.5 text-sm font-mono"
              value={cvv}
              onChange={(e) => setCvv(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        isLoading={isProcessing}
        className="w-full py-3 font-bold flex justify-center text-sm"
      >
        Pay ${(totalCents / 100).toFixed(2)} (Sandbox Mode)
      </Button>
    </form>
  );
};

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, setUser } = useAuth();
  const { addToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number>(0);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // New Address inline fields
  const [newLabel, setNewLabel] = useState('Home');
  const [newLine1, setNewLine1] = useState('');
  const [newLine2, setNewLine2] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newCountry, setNewCountry] = useState('United States');

  // Checkout sessions details
  const [sessionData, setSessionData] = useState<CheckoutSessionData | null>(null);
  const [orderSummaryCollapsed, setOrderSummaryCollapsed] = useState(true);

  // Polling states
  const [pollingStatus, setPollingStatus] = useState<'idle' | 'polling' | 'failed'>('idle');

  // Redirect if guest/unauthenticated
  useEffect(() => {
    if (!isAuthenticated) {
      addToast('Please login to finalize your checkout.', 'warning');
      navigate('/login?redirect=/checkout');
    }
  }, [isAuthenticated]);

  // Default address index selector
  useEffect(() => {
    if (user?.addresses && user.addresses.length > 0) {
      const defaultIdx = user.addresses.findIndex((addr) => addr.isDefault);
      setSelectedAddressIndex(defaultIdx > -1 ? defaultIdx : 0);
    } else {
      setShowNewAddressForm(true);
    }
  }, [user]);

  // Handle address submit
  const handleAddNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLine1.trim() || !newCity.trim() || !newCountry.trim()) {
      addToast('Please fill in Line 1, City, and Country.', 'error');
      return;
    }

    try {
      setIsSavingAddress(true);
      const newAddr: Address = {
        label: newLabel.trim(),
        line1: newLine1.trim(),
        line2: newLine2.trim() || undefined,
        city: newCity.trim(),
        country: newCountry.trim(),
        isDefault: user?.addresses && user.addresses.length === 0, // default if first
      };

      const existingAddresses = user?.addresses || [];
      const updatedAddresses = [...existingAddresses, newAddr];

      const res = await api.patch('/auth/profile', { addresses: updatedAddresses });
      if (res.data?.success) {
        setUser((prev) => (prev ? { ...prev, addresses: res.data.data.addresses } : prev));
        addToast('Shipping address added successfully.', 'success');
        
        // Reset form
        setNewLine1('');
        setNewLine2('');
        setNewCity('');
        setNewLabel('Home');
        setShowNewAddressForm(false);
        
        // Auto select the newly added address
        setSelectedAddressIndex(res.data.data.addresses.length - 1);
      }
    } catch {
      addToast('Failed to save address.', 'error');
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Move to Step 2 (Create checkout intent)
  const handleProceedToPayment = async () => {
    const addresses = user?.addresses || [];
    let shippingAddress: Address | null = null;

    if (addresses.length > 0 && selectedAddressIndex < addresses.length) {
      shippingAddress = addresses[selectedAddressIndex];
    }

    if (!shippingAddress) {
      addToast('Please select or add a shipping address first.', 'error');
      return;
    }

    // Retrieve active coupon code applied if stored in localStorage/session
    // In our simplified setup, we can check if coupon was entered
    const storedCoupon = localStorage.getItem('applied_coupon_code') || '';

    try {
      const res = await api.post('/orders/checkout-session', {
        shippingAddress: {
          line1: shippingAddress.line1,
          line2: shippingAddress.line2,
          city: shippingAddress.city,
          country: shippingAddress.country,
        },
        couponCode: storedCoupon || undefined,
      });

      if (res.data?.success) {
        setSessionData(res.data.data);
        setStep(2);
        addToast('Payment session initialized.', 'success');
      }
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Checkout failed. Verify items stock availability.'), 'error');
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        // Stock conflict, back to cart
        navigate('/cart');
      }
    }
  };

  // Move to Step 3: Polling status confirmations
  const handlePaymentSuccess = () => {
    setStep(3);
    setPollingStatus('polling');
  };

  // Polling loop
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const maxAttempts = 15; // 30s timeout

    const checkOrderStatus = async () => {
      if (!sessionData) return;
      try {
        attempts++;
        const res = await api.get(`/orders/status/${sessionData.paymentIntentId}`);
        if (res.data?.success && res.data.confirmed) {
          addToast('Order successfully processed!', 'success');
          // Clear active local storage carts
          localStorage.removeItem('applied_coupon_code');
          navigate(`/order-confirmation/${res.data.order._id}`);
          return;
        }

        if (attempts >= maxAttempts) {
          setPollingStatus('failed');
          addToast('Checkout webhook confirmation timed out. Order is pending approval.', 'warning');
        } else {
          // Poll again in 2s
          timer = setTimeout(checkOrderStatus, 2000);
        }
      } catch (error) {
        console.error('Order status polling error:', error);
        timer = setTimeout(checkOrderStatus, 2000);
      }
    };

    if (step === 3 && pollingStatus === 'polling') {
      checkOrderStatus();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [step, pollingStatus, sessionData]);

  const mockSecret = sessionData?.clientSecret.startsWith('mock_secret_');

  return (
    <StorefrontLayout breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Cart', href: '/cart' }, { label: 'Checkout' }]}>
      <div className="max-w-3xl mx-auto px-4 py-8 font-sans">
        
        {/* Progress Tracker bar */}
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs transition-all ${
              step >= 1 ? 'bg-primary-dark text-white' : 'bg-dashboard-section-bg text-text-secondary'
            }`}>1</span>
            <span className="text-xs font-bold text-text-primary hidden sm:inline">Shipping Address</span>
          </div>
          <div className="flex-grow h-0.5 mx-4 bg-dashboard-section-bg" />
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs transition-all ${
              step >= 2 ? 'bg-primary-dark text-white' : 'bg-dashboard-section-bg text-text-secondary'
            }`}>2</span>
            <span className="text-xs font-bold text-text-primary hidden sm:inline">Payment Method</span>
          </div>
          <div className="flex-grow h-0.5 mx-4 bg-dashboard-section-bg" />
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs transition-all ${
              step >= 3 ? 'bg-primary-dark text-white' : 'bg-dashboard-section-bg text-text-secondary'
            }`}>3</span>
            <span className="text-xs font-bold text-text-primary hidden sm:inline">Confirmation</span>
          </div>
        </div>

        {/* STEP 1: SHIPPING ADDRESS */}
        {step === 1 && (
          <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1 text-left space-y-6">
            <div className="flex items-center gap-2 text-primary-dark font-bold text-lg border-b border-dashboard-section-bg pb-3">
              <MapPin className="h-5 w-5" />
              <h2>Shipping Address Selection</h2>
            </div>

            {/* Address Radios list */}
            {user?.addresses && user.addresses.length > 0 && (
              <div className="space-y-3">
                {user.addresses.map((addr, index) => (
                  <label
                    key={index}
                    onClick={() => setSelectedAddressIndex(index)}
                    className={`flex items-start gap-4 p-4 border rounded-card cursor-pointer transition-all ${
                      selectedAddressIndex === index ? 'border-primary bg-primary-bg/10 ring-2 ring-primary/20' : 'border-dashboard-section-bg hover:bg-dashboard-section-bg/25'
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping-address-radio"
                      checked={selectedAddressIndex === index}
                      onChange={() => setSelectedAddressIndex(index)}
                      className="mt-1 accent-primary"
                    />
                    <div className="flex-grow text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-primary">{addr.label || 'Address'}</span>
                        {addr.isDefault && (
                          <span className="bg-success-bg/15 border border-success/30 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold text-success">
                            Default
                          </span>
                        )}
                      </div>
                      <span className="text-text-secondary block mt-1">{addr.line1}</span>
                      {addr.line2 && <span className="text-text-secondary block">{addr.line2}</span>}
                      <span className="text-text-secondary block">{addr.city}, {addr.country}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Toggle Add New Address Form */}
            <div>
              <button
                type="button"
                onClick={() => setShowNewAddressForm(!showNewAddressForm)}
                className="text-xs text-primary font-bold hover:underline flex items-center gap-1.5 focus:outline-none"
              >
                {showNewAddressForm ? '- Cancel new address' : '+ Ship to a new address'}
              </button>

              {showNewAddressForm && (
                <form onSubmit={handleAddNewAddress} className="mt-4 bg-dashboard-section-bg/20 p-4 rounded-card border border-dashboard-section-bg/30 space-y-4 animate-slide-in">
                  <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">Add Shipping Address</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      id="label"
                      label="Address Label"
                      type="text"
                      placeholder="e.g. Home, Office"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                    />
                    <Input
                      id="country"
                      label="Country"
                      type="text"
                      placeholder="Country"
                      value={newCountry}
                      onChange={(e) => setNewCountry(e.target.value)}
                      required
                    />
                  </div>

                  <Input
                    id="line1"
                    label="Address Line 1"
                    type="text"
                    placeholder="Street Address, P.O. Box"
                    value={newLine1}
                    onChange={(e) => setNewLine1(e.target.value)}
                    required
                  />

                  <Input
                    id="line2"
                    label="Address Line 2 (Optional)"
                    type="text"
                    placeholder="Apartment, suite, unit, building"
                    value={newLine2}
                    onChange={(e) => setNewLine2(e.target.value)}
                  />

                  <Input
                    id="city"
                    label="City"
                    type="text"
                    placeholder="City"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    required
                  />

                  <Button
                    type="submit"
                    variant="secondary"
                    isLoading={isSavingAddress}
                    className="w-full py-2.5 text-xs text-center"
                  >
                    Save & Select Address
                  </Button>
                </form>
              )}
            </div>

            <Button
              onClick={handleProceedToPayment}
              variant="primary"
              disabled={showNewAddressForm && (newLine1.trim() !== '')}
              className="w-full py-3 text-sm font-bold flex justify-center"
            >
              Continue to Payment Method
            </Button>
          </div>
        )}

        {/* STEP 2: PAYMENT ELEMENT */}
        {step === 2 && sessionData && (
          <div className="space-y-6 text-left">
            {/* Collapse order summary */}
            <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-4 shadow-level1">
              <button
                onClick={() => setOrderSummaryCollapsed(!orderSummaryCollapsed)}
                className="w-full flex items-center justify-between text-sm font-bold text-text-primary focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <span className="bg-dashboard-section-bg px-2 py-0.5 rounded text-xs font-semibold text-text-secondary">Recap</span>
                  <span>Review Order Total: ${(sessionData.totalCents / 100).toFixed(2)}</span>
                </div>
                {orderSummaryCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>

              {!orderSummaryCollapsed && (
                <div className="mt-4 border-t border-dashboard-section-bg pt-4 space-y-2 text-xs text-text-secondary animate-scale-in">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${(sessionData.subtotalCents / 100).toFixed(2)}</span>
                  </div>
                  {sessionData.discountCents > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Applied Discount</span>
                      <span>-${(sessionData.discountCents / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-text-primary border-t border-dashboard-section-bg pt-2">
                    <span>Total Amount</span>
                    <span>${(sessionData.totalCents / 100).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment element card */}
            <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1 space-y-6">
              <div className="flex items-center gap-2 text-primary-dark font-bold text-lg border-b border-dashboard-section-bg pb-3">
                <CreditCard className="h-5 w-5" />
                <h2>Select Payment Method</h2>
              </div>

              {/* Toggle Stripe vs Mock form */}
              {mockSecret ? (
                <MockPaymentForm
                  paymentIntentId={sessionData.paymentIntentId}
                  totalCents={sessionData.totalCents}
                  onPaymentSuccess={handlePaymentSuccess}
                />
              ) : (
                <Elements stripe={stripePromise} options={{ clientSecret: sessionData.clientSecret }}>
                  <CheckoutForm
                    clientSecret={sessionData.clientSecret}
                    paymentIntentId={sessionData.paymentIntentId}
                    totalCents={sessionData.totalCents}
                    onPaymentSuccess={handlePaymentSuccess}
                  />
                </Elements>
              )}

              <div className="flex items-center justify-center gap-2 text-[10px] text-text-muted mt-4">
                <ShieldCheck className="h-4 w-4 text-success" /> Securing payments powered by Stripe. SSL Encrypted.
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: TRANSACTION POLLING STATUS */}
        {step === 3 && (
          <div className="bg-surface border border-dashboard-section-bg/50 rounded-card p-10 shadow-level2 text-center space-y-6">
            {pollingStatus === 'polling' ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <h2 className="text-lg font-bold text-text-primary">Validating Transaction Details</h2>
                <p className="text-sm text-text-secondary max-w-sm">
                  We are reconciling your credit authorization with our warehouse inventory records. Please do not close or reload this window.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-8">
                <span className="text-warning text-5xl">⚠️</span>
                <h2 className="text-lg font-bold text-text-primary">Confirmation Pending</h2>
                <p className="text-sm text-text-secondary max-w-sm">
                  Your payment was authorized, but we are still waiting for confirmation from our bank hook. Check your Order History under Account Dashboard.
                </p>
                <Button
                  onClick={() => navigate('/account')}
                  variant="primary"
                  className="px-6 py-2 text-xs"
                >
                  View Orders
                </Button>
              </div>
            )}
          </div>
        )}

      </div>
    </StorefrontLayout>
  );
};

export default Checkout;
