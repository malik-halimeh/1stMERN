export class AppError extends Error {
    code;
    statusCode;
    details;
    constructor(code, message, statusCode = 400, details = []) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
// Predefined error creator helper
export const createError = (code, message, statusCode = 400, details = []) => {
    return new AppError(code, message, statusCode, details);
};
