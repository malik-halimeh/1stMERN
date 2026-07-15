import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import Input from '../components/ui/Input.js';
import Button from '../components/ui/Button.js';
import { User, Mail, Lock, ShieldCheck } from 'lucide-react';
import { mergeGuestData } from '../utils/guestMerge.js';
import { useShop } from '../context/ShopContext.js';

const RESEND_COOLDOWN_S = 30;

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verification step state
  const [step, setStep] = useState<'details' | 'verify'>('details');
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { register, verifyEmail, resendVerification } = useAuth();
  const { refreshShopData } = useShop();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Arriving from Login with an unverified account (?verify=<email>) jumps
  // straight to the code-entry step — the server has already sent a code.
  useEffect(() => {
    const verifyParam = searchParams.get('verify');
    if (verifyParam) {
      setPendingEmail(verifyParam);
      setStep('verify');
    }
  }, [searchParams]);

  // Resend cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Client side validation check
  const validateForm = (): boolean => {
    if (!name || !email || !password || !confirmPassword) {
      addToast('Please fill out all fields.', 'warning');
      return false;
    }
    if (password !== confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return false;
    }

    // Password validation regex rules: >= 8 characters, at least 1 uppercase and 1 number
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

    if (!agreeTerms) {
      addToast('You must agree to the Terms of Service.', 'warning');
      return false;
    }
    return true;
  };

  // Step 1 — create pending account, server emails the verification code
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const result = await register(name, email, password);
      setPendingEmail(result.email);
      setStep('verify');
      setResendCooldown(RESEND_COOLDOWN_S);
      addToast('We sent a 6-digit verification code to your email.', 'success');
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message || 'Registration failed. Email might already exist.';
      addToast(errMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2 — confirm the code, session opens, sync guest data
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      addToast('Please enter the 6-digit code from your email.', 'warning');
      return;
    }

    setIsVerifying(true);
    try {
      const sessionUser = await verifyEmail(pendingEmail, trimmed);

      // Staff accounts land on the admin dashboard, never the storefront
      if (sessionUser.role === 'super_admin' || sessionUser.role === 'inventory_manager') {
        addToast('Email verified — welcome to OptiCart!', 'success');
        navigate('/admin/dashboard', { replace: true });
        return;
      }

      await mergeGuestData(addToast);
      await refreshShopData();
      addToast('Email verified — welcome to OptiCart!', 'success');
      // Customers land on the storefront, ready to shop
      navigate('/', { replace: true });
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message || 'Verification failed. Please check the code.';
      addToast(errMsg, 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendVerification(pendingEmail);
      setResendCooldown(RESEND_COOLDOWN_S);
      addToast('A new verification code has been sent.', 'success');
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
          {step === 'details' ? (
            <>
              <h2 className="mt-6 text-2xl font-bold text-text-primary">Create your account</h2>
              <p className="mt-2 text-sm text-text-muted">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-secondary hover:text-accent transition-colors">
                  Sign in instead
                </Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-6 text-2xl font-bold text-text-primary flex items-center justify-center gap-2">
                <ShieldCheck className="h-6 w-6 text-success" /> Verify your email
              </h2>
              <p className="mt-2 text-sm text-text-muted">
                We sent a 6-digit code to <strong className="text-text-primary">{pendingEmail}</strong>.
                Enter it below to activate your account.
              </p>
            </>
          )}
        </div>

        {step === 'details' ? (
          <>
            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <Input
                  id="name"
                  label="Full Name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  leadingIcon={<User className="h-4 w-4 text-text-muted" />}
                />

                <Input
                  id="email-address"
                  label="Email Address"
                  type="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  leadingIcon={<Mail className="h-4 w-4 text-text-muted" />}
                  helperText="A verification code will be sent to this address."
                />

                <Input
                  id="password"
                  label="Password"
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
                  id="confirm-password"
                  label="Confirm Password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  leadingIcon={<Lock className="h-4 w-4 text-text-muted" />}
                />
              </div>

              <div className="flex items-start mt-4">
                <div className="flex items-center h-5">
                  <input
                    id="agree"
                    name="agree"
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="h-4 w-4 text-secondary focus:ring-secondary border-text-disabled rounded cursor-pointer"
                  />
                </div>
                <div className="ml-3 text-xs select-none">
                  <label htmlFor="agree" className="font-medium text-text-secondary cursor-pointer">
                    I agree to the{' '}
                    <a href="#terms" className="text-secondary hover:underline">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="#privacy" className="text-secondary hover:underline">
                      Privacy Policy
                    </a>.
                  </label>
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full py-2.5 font-semibold mt-4"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending code...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleVerify}>
            <Input
              id="verification-code"
              label="Verification Code"
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

            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5 font-semibold"
              disabled={isVerifying}
            >
              {isVerifying ? 'Verifying...' : 'Verify & Sign In'}
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
                onClick={() => setStep('details')}
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

export default Register;
