import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext.js';
import StorefrontLayout from '../components/layout/StorefrontLayout.js';
import Button from '../components/ui/Button.js';
import api from '../services/api.js';

const CheckoutRedirect: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  const [status, setStatus] = useState<'loading' | 'failed'>('loading');
  const paymentIntentId = searchParams.get('payment_intent');

  useEffect(() => {
    if (!paymentIntentId) {
      addToast('No payment session reference found in URL.', 'error');
      navigate('/cart');
      return;
    }

    let timer: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 15;

    const checkStatus = async () => {
      try {
        attempts++;
        const res = await api.get(`/orders/status/${paymentIntentId}`);
        if (res.data?.success && res.data.confirmed) {
          addToast('Payment confirmed and order captured!', 'success');
          // Clear active localStorage coupon
          localStorage.removeItem('applied_coupon_code');
          navigate(`/order-confirmation/${res.data.order._id}`);
          return;
        }

        if (attempts >= maxAttempts) {
          setStatus('failed');
          addToast('Webhook confirmation timed out. Order will process in background.', 'warning');
        } else {
          timer = setTimeout(checkStatus, 2000);
        }
      } catch (err) {
        console.error('Reconciliation check error:', err);
        timer = setTimeout(checkStatus, 2000);
      }
    };

    checkStatus();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [paymentIntentId]);

  return (
    <StorefrontLayout>
      <div className="max-w-md mx-auto my-16 px-4 py-8 bg-surface border border-dashboard-section-bg/50 rounded-card shadow-level2 text-center space-y-6 font-sans">
        {status === 'loading' ? (
          <div className="flex flex-col items-center gap-4 py-8 text-left">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <h2 className="text-lg font-bold text-text-primary text-center w-full">Finalizing Order Transaction</h2>
            <p className="text-xs text-text-secondary text-center leading-relaxed">
              We are verifying payment authorization with our merchant processor and reserving inventory allocation. Please do not close this window.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8">
            <span className="text-warning text-5xl">⚠️</span>
            <h2 className="text-lg font-bold text-text-primary">Status Check Suspended</h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Your credit authorization completed, but inventory syncing is taking longer than expected. You can track this order under your Account Dashboard.
            </p>
            <Button
              onClick={() => navigate('/account')}
              variant="primary"
              className="px-6 py-2 text-xs"
            >
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
};

export default CheckoutRedirect;
