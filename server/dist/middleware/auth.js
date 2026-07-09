import { verifyAccessToken } from '../utils/tokens.js';
import { AppError } from '../utils/errors.js';
// 1. Authentication middleware
export const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new AppError('AUTH_UNAUTHORIZED', 'Access token is missing or malformed.', 401));
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = verifyAccessToken(token);
        req.user = {
            userId: decoded.userId,
            role: decoded.role,
        };
        next();
    }
    catch (error) {
        // Let the global error handler map JWT errors to proper status/codes
        next(error);
    }
};
// 2. Role Authorization middleware (RBAC)
export const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('AUTH_UNAUTHORIZED', 'User session is not authenticated.', 401));
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new AppError('AUTH_FORBIDDEN', 'Access denied. Insufficient permissions.', 403));
        }
        next();
    };
};
