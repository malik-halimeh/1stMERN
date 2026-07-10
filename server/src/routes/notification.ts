import { Router } from 'express';
import { getNotifications, markAllNotificationsRead } from '../controllers/notification.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Any authenticated user reads their own notifications
router.use(authenticate);
router.get('/', getNotifications);
router.patch('/read-all', markAllNotificationsRead);

export default router;
