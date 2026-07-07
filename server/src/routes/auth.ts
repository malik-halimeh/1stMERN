import { Router } from 'express';
import { register, login, refresh, logout, forgotPassword, updateProfile, getProfile } from '../controllers/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Rate limiting applies to all authentication and session endpoints
router.use(authRateLimiter as any);

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.get('/profile', authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);

export default router;
