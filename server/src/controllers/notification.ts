import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { AppError } from '../utils/errors.js';

// 1. GET /api/notifications — own notifications, newest first, plus unread count
export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Session is not authenticated.', 401);
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 30));

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      data: notifications,
      meta: { unreadCount },
    });
  } catch (error) {
    next(error);
  }
};

// 2. PATCH /api/notifications/read-all — mark every own notification as read
export const markAllNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Session is not authenticated.', 401);
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });

    res.status(200).json({ success: true, data: { message: 'All notifications marked as read.' } });
  } catch (error) {
    next(error);
  }
};
