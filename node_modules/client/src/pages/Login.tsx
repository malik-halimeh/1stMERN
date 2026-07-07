import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import Input from '../components/ui/Input.js';
import Button from '../components/ui/Button.js';
import { Lock, Mail } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Find previous redirect path or default to '/account'
  const searchParams = new URLSearchParams(location.search);
  const from = searchParams.get('redirect') || '/account';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Please enter both email and password.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      
      // Cart merge-on-login logic
      const guestCartStored = localStorage.getItem('guest_cart');
      if (guestCartStored) {
        try {
          const parsed = JSON.parse(guestCartStored);
          if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
            await api.post('/cart/merge', { items: parsed.items });
            addToast('Synchronized guest cart with your account.', 'success');
          }
        } catch (mergeErr) {
          console.error('Guest cart merge failed:', mergeErr);
        } finally {
          localStorage.removeItem('guest_cart');
        }
      }

      addToast('Welcome back! You have logged in successfully.', 'success');
      navigate(from, { replace: true });
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message || 'Login failed. Please check your credentials.';
      addToast(errMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-dashboard-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8 bg-surface p-8 rounded-card border border-dashboard-section-bg/60 shadow-level2">
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
      </div>
    </div>
  );
};

export default Login;
