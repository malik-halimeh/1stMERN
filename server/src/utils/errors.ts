export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public details: any[];

  constructor(
    code: string,
    message: string,
    statusCode: number = 400,
    details: any[] = []
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Predefined error creator helper
export const createError = (
  code: string,
  message: string,
  statusCode: number = 400,
  details: any[] = []
): AppError => {
  return new AppError(code, message, statusCode, details);
};
