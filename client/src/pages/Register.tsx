import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import Input from '../components/ui/Input.js';
import Button from '../components/ui/Button.js';
import { User, Mail, Lock } from 'lucide-react';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await register(name, email, password);

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

      addToast('Registration completed successfully! Welcome to OptiCart.', 'success');
      navigate('/account');
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message || 'Registration failed. Email might already exist.';
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
          <h2 className="mt-6 text-2xl font-bold text-text-primary">Create your account</h2>
          <p className="mt-2 text-sm text-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-secondary hover:text-accent transition-colors">
              Sign in instead
            </Link>
          </p>
        </div>

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
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
