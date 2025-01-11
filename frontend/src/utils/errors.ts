/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error,
    public retry?: boolean,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retry: this.retry,
      statusCode: this.statusCode,
      stack: this.stack,
    };
  }
}

/**
 * Network-related errors (API calls, WebSocket, etc.)
 */
export class NetworkError extends AppError {
  constructor(message: string, originalError?: Error, statusCode?: number) {
    super(message, 'NETWORK_ERROR', originalError, true, statusCode);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Validation errors (form validation, data validation, etc.)
 */
export class ValidationError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 'VALIDATION_ERROR', originalError, false, 400);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Authentication errors (login, token expired, etc.)
 */
export class AuthError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 'AUTH_ERROR', originalError, true, 401);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Authorization errors (insufficient permissions, etc.)
 */
export class PermissionError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 'PERMISSION_ERROR', originalError, false, 403);
    this.name = 'PermissionError';
    Object.setPrototypeOf(this, PermissionError.prototype);
  }
}

/**
 * Not found errors (resource not found, etc.)
 */
export class NotFoundError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 'NOT_FOUND_ERROR', originalError, false, 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Rate limit errors (too many requests, etc.)
 */
export class RateLimitError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 'RATE_LIMIT_ERROR', originalError, true, 429);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};

/**
 * Type guard to check if an error should be retried
 */
export const shouldRetry = (error: unknown): boolean => {
  if (!isAppError(error)) return false;
  return error.retry === true;
}; 