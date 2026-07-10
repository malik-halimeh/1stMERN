import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import Input from '../components/ui/Input.js';
import Button from '../components/ui/Button.js';
import GoogleSignInButton from '../components/ui/GoogleSignInButton.js';
import { ArrowLeft, Lock, Mail } from 'lucide-react';
import { mergeGuestData } from '../utils/guestMerge.js';
import { useShop } from '../context/ShopContext.js';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const { refreshShopData } = useShop();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Find previous redirect path or default to '/account'
  const searchParams = new URLSearchParams(location.search);
  const from = searchParams.get('redirect') || '/account';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Re-entry guard: a second click/Enter while the first attempt is still
    // in flight would log in twice and stack duplicate success toasts
    if (isSubmitting) return;

    // Read values straight from the form as well: browser autofill can fill
    // the fields without firing React onChange, leaving state empty on the
    // first click (the old "click Login twice" bug).
    const formData = new FormData(e.currentTarget);
    const emailValue = (email || String(formData.get('email') || '')).trim();
    const passwordValue = password || String(formData.get('password') || '');

    if (!emailValue || !passwordValue) {
      addToast('Please enter both email and password.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const sessionUser = await login(emailValue, passwordValue);

      // Staff always land on the admin dashboard — never the storefront —
      // and skip the guest cart/wishlist merge (a customer-only flow).
      if (sessionUser.role === 'super_admin' || sessionUser.role === 'inventory_manager') {
        addToast('Welcome back! You have logged in successfully.', 'success');
        navigate('/admin/dashboard', { replace: true });
        return;
      }

      // Navigate right away; the guest cart/wishlist sync runs in the
      // background so a slow merge never leaves the user stuck on this page
      addToast('Welcome back! You have logged in successfully.', 'success');
      navigate(from, { replace: true });
      mergeGuestData(addToast)
        .then(() => refreshShopData())
        .catch((err) => console.error('Post-login guest sync failed:', err));
    } catch (error: any) {
      // Unverified signup: a fresh code was just emailed — jump to code entry
      if (error.response?.data?.error?.code === 'AUTH_EMAIL_NOT_VERIFIED') {
        addToast('Please verify your email. We just sent you a new code.', 'warning');
        navigate(`/register?verify=${encodeURIComponent(emailValue)}`);
        return;
      }
      const errMsg = error.response?.data?.error?.message || 'Login failed. Please check your credentials.';
      addToast(errMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Google sign-in — verified by Google, no code flow needed
  const handleGoogleCredential = async (credential: string) => {
    try {
      const sessionUser = await loginWithGoogle(credential);

      if (sessionUser.role === 'super_admin' || sessionUser.role === 'inventory_manager') {
        addToast('Signed in with Google successfully.', 'success');
        navigate('/admin/dashboard', { replace: true });
        return;
      }

      addToast('Signed in with Google successfully.', 'success');
      navigate(from, { replace: true });
      mergeGuestData(addToast)
        .then(() => refreshShopData())
        .catch((err) => console.error('Post-login guest sync failed:', err));
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message || 'Google sign-in failed.';
      addToast(errMsg, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-dashboard-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8 bg-surface p-8 rounded-card border border-dashboard-section-bg/60 shadow-level2">
        {/* Back to the store */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to store
        </Link>

        <div className="text-center">
          <Link to="/" className="text-display text-text-primary text-3xl font-extrabold tracking-tight select-none">
            Opti<span className="text-secondary">Cart</span>
          </Link>
          <h2 className="mt-6 text-2xl font-bold text-text-primary">Sign in to your account</h2>
          <p className="mt-2 text-sm text-text-muted">
            Or{' '}
            <Link to="/register" className="font-semibold text-secondary hover:text-accent transition-colors">
              create a new account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              id="email-address"
              name="email"
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              leadingIcon={<Mail className="h-4 w-4 text-text-muted" />}
            />

            <Input
              id="password"
              name="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              leadingIcon={<Lock className="h-4 w-4 text-text-muted" />}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-secondary focus:ring-secondary border-text-disabled rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-xs text-text-secondary select-none">
                Remember me
              </label>
            </div>

            <div className="text-xs">
              <Link to="/forgot-password" className="font-semibold text-secondary hover:text-accent transition-colors">
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5 font-semibold mt-4"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        </form>

        <GoogleSignInButton onCredential={handleGoogleCredential} text="signin_with" />
      </div>
    </div>
  );
};

export default Login;
