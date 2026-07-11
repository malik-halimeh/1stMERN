import { Router } from 'express';
import { register, verifyEmail, resendVerification, googleAuth, login, refresh, logout, forgotPassword, resetPassword, updateProfile, getProfile, } from '../controllers/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/auth.js';
const router = Router();
// Rate limiting applied ONLY to the endpoints where repeated automated attempts
// are a security concern: login, register, verification, and forgot-password.
// Critically, /refresh and /logout are NOT rate-limited here — they fire
// automatically (silent refresh on mount, 401 interceptor retries) and must
// never count against the user's login-attempt budget.
router.post('/register', authRateLimiter, register);
router.post('/verify-email', authRateLimiter, verifyEmail);
router.post('/resend-verification', authRateLimiter, resendVerification);
router.post('/google', authRateLimiter, googleAuth);
router.post('/login', authRateLimiter, login);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);
// These do NOT touch the auth rate-limit counter:
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/profile', authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);
export default router;
