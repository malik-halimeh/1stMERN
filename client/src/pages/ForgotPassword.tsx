import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import Input from '../components/ui/Input.js';
import Button from '../components/ui/Button.js';
import { Mail, Lock, ShieldCheck } from 'lucide-react';
import { mergeGuestData } from '../utils/guestMerge.js';
import { useShop } from '../context/ShopContext.js';

const RESEND_COOLDOWN_S = 30;

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset step state (mirrors the signup verification step)
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { forgotPassword, resetPassword } = useAuth();
  const { refreshShopData } = useShop();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Resend cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Step 1 — request the 6-digit reset code
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      addToast('Please enter your email address.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword(email);
    } catch {
      // Same UX either way — the server never reveals whether the email exists
    } finally {
      setIsSubmitting(false);
    }
    setStep('reset');
    setResendCooldown(RESEND_COOLDOWN_S);
    addToast('If the email is registered, a 6-digit reset code has been sent.', 'success');
  };

  const validateNewPassword = (): boolean => {
    if (password !== confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return false;
    }
    if (password.length < 8) {
      addToast('Password must be at least 8 characters long.', 'error');
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      addToast('Password must contain at least one uppercase letter.', 'error');
      return false;
    }
    if (!/[0-9]/.test(password)) {
      addToast('Password must contain at least one numeric digit.', 'error');
      return false;
    }
    return true;
  };

  // Step 2 — confirm the code + new password, session opens
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      addToast('Please enter the 6-digit code from your email.', 'warning');
      return;
    }
    if (!validateNewPassword()) return;

    setIsResetting(true);
    try {
      const sessionUser = await resetPassword(email, trimmed, password);

      // Staff accounts land on the admin dashboard, never the storefront
      if (sessionUser.role === 'super_admin' || sessionUser.role === 'inventory_manager') {
        addToast('Password updated — welcome back!', 'success');
        navigate('/admin/dashboard', { replace: true });
        return;
      }

      await mergeGuestData(addToast);
      await refreshShopData();
      addToast('Password updated — welcome back!', 'success');
      // Customers land on the storefront, ready to shop
      navigate('/', { replace: true });
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message || 'Reset failed. Please check the code.';
      addToast(errMsg, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await forgotPassword(email);
      setResendCooldown(RESEND_COOLDOWN_S);
      addToast('A new reset code has been sent.', 'success');
    } catch {
      addToast('Could not resend the code. Try again shortly.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-dashboard-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8 bg-surface p-8 rounded-card border border-dashboard-section-bg/60 shadow-level2">
        <div className="text-center">
          <Link to="/" className="text-display text-text-primary text-3xl font-extrabold tracking-tight select-none">
            Opti<span className="text-secondary">Cart</span>
          </Link>
          {step === 'email' ? (
            <>
              <h2 className="mt-6 text-2xl font-bold text-text-primary">Reset your password</h2>
              <p className="mt-2 text-sm text-text-muted">
                Enter your email and we will send you a 6-digit reset code.
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-6 text-2xl font-bold text-text-primary flex items-center justify-center gap-2">
                <ShieldCheck className="h-6 w-6 text-success" /> Enter your reset code
              </h2>
              <p className="mt-2 text-sm text-text-muted">
                We sent a 6-digit code to <strong className="text-text-primary">{email}</strong>.
                Enter it below with your new password.
              </p>
            </>
          )}
        </div>

        {step === 'email' ? (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <Input
                id="email-address"
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                leadingIcon={<Mail className="h-4 w-4 text-text-muted" />}
                helperText="A reset code will be sent to this address."
              />
            </div>

            <div>
              <Button
                type="submit"
                variant="primary"
                className="w-full py-2.5 font-semibold mt-4"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending code...' : 'Send Reset Code'}
              </Button>
            </div>

            <div className="text-center text-xs">
              <Link to="/login" className="font-semibold text-secondary hover:text-accent transition-colors">
                Back to sign in
              </Link>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleReset}>
            <Input
              id="reset-code"
              label="Reset Code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              autoComplete="one-time-code"
              className="tracking-[0.5em] text-center font-mono text-lg"
              leadingIcon={<ShieldCheck className="h-4 w-4 text-text-muted" />}
              helperText="The code expires in 15 minutes."
            />

            <Input
              id="new-password"
              label="New Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              leadingIcon={<Lock className="h-4 w-4 text-text-muted" />}
              helperText="Min. 8 characters, 1 uppercase letter, and 1 numeric digit."
            />

            <Input
              id="confirm-new-password"
              label="Confirm New Password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              leadingIcon={<Lock className="h-4 w-4 text-text-muted" />}
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5 font-semibold"
              disabled={isResetting}
            >
              {isResetting ? 'Resetting...' : 'Reset Password & Sign In'}
            </Button>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="font-semibold text-secondary hover:text-accent transition-colors disabled:text-text-muted disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </button>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="font-semibold text-text-muted hover:text-text-secondary transition-colors"
              >
                Use a different email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
