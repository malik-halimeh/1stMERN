import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/tokens.js';
import { AppError } from '../utils/errors.js';

// Extend Express Request interface to hold authenticated user details
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: 'customer' | 'inventory_manager' | 'super_admin';
      };
    }
  }
}

// 1. Authentication middleware
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('AUTH_UNAUTHORIZED', 'Access token is missing or malformed.', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      userId: decoded.userId,
      role: decoded.role as 'customer' | 'inventory_manager' | 'super_admin',
    };
    next();
  } catch (error) {
    // Let the global error handler map JWT errors to proper status/codes
    next(error);
  }
};

// 2. Role Authorization middleware (RBAC)
export const authorize = (...allowedRoles: ('customer' | 'inventory_manager' | 'super_admin')[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('AUTH_UNAUTHORIZED', 'User session is not authenticated.', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('AUTH_FORBIDDEN', 'Access denied. Insufficient permissions.', 403));
    }

    next();
  };
};
