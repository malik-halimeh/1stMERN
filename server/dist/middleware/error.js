import { AppError } from '../utils/errors.js';
export const errorHandler = (err, req, res, _next) => {
    let statusCode = 500;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred.';
    let details = [];
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        code = err.code;
        message = err.message;
        details = err.details;
    }
    else if (err.name === 'ValidationError') {
        // MongoDB/Mongoose validation error
        statusCode = 400;
        code = 'DB_VALIDATION_ERROR';
        message = err.message;
    }
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        code = 'AUTH_INVALID_TOKEN';
        message = 'The security token is invalid.';
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        code = 'AUTH_TOKEN_EXPIRED';
        message = 'The security token has expired.';
    }
    else {
        // General developer or unexpected exception
        message = err.message || 'Internal Server Error';
    }
    console.error(`[Error Handler] ${req.method} ${req.path} - Code: ${code} - Status: ${statusCode} - Message: ${message}`);
    if (err.stack && process.env.NODE_ENV !== 'production') {
        console.error(err.stack);
    }
    res.status(statusCode).json({
        success: false,
        error: {
            code,
            message,
            details,
        },
    });
};
export const notFound = (req, res, next) => {
    const error = new AppError('ROUTE_NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`, 404);
    next(error);
};
