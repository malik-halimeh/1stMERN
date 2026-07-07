import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import Input from '../components/ui/Input.js';
import Button from '../components/ui/Button.js';
import { Mail, CheckCircle } from 'lucide-react';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { forgotPassword } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      addToast('Please enter your email address.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword(email);
      // Success states
      setIsSubmitted(true);
      addToast('Password reset link triggered.', 'success');
    } catch (error) {
      // In compliance with security guidelines, we still show the success message screen
      // so we do not leak email existence.
      setIsSubmitted(true);
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
          <h2 className="mt-6 text-2xl font-bold text-text-primary">Reset your password</h2>
          <p className="mt-2 text-sm text-text-muted">
            We will send you instructions to reset your account password.
          </p>
        </div>

        {!isSubmitted ? (
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
            </div>

            <div>
              <Button
                type="submit"
                variant="primary"
                className="w-full py-2.5 font-semibold mt-4"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending link...' : 'Send Reset Link'}
              </Button>
            </div>

            <div className="text-center text-xs">
              <Link to="/login" className="font-semibold text-secondary hover:text-accent transition-colors">
                Back to sign in
              </Link>
            </div>
          </form>
        ) : (
          <div className="mt-8 text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="h-16 w-16 text-success animate-bounce" />
            </div>
            <div className="bg-success-bg/10 border border-success/20 p-4 rounded-card text-left">
              <p className="text-sm text-text-primary font-medium">
                If an account matches **{email}**, we have sent an email with a secure link to reset your password.
              </p>
              <p className="text-xs text-text-muted mt-2">
                Please check your inbox (and spam folder). The link will be active for 1 hour.
              </p>
            </div>
            <div>
              <Link to="/login">
                <Button variant="secondary" className="w-full py-2">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
