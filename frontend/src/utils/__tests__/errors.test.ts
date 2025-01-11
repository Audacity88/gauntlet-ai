import {
  AppError,
  NetworkError,
  ValidationError,
  AuthError,
  PermissionError,
  NotFoundError,
  RateLimitError,
  isAppError,
  shouldRetry
} from '../errors';

describe('Error System', () => {
  describe('AppError', () => {
    it('creates base error with correct properties', () => {
      const error = new AppError('Test error', 'TEST_ERROR', undefined, true, 500);
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.retry).toBe(true);
      expect(error.statusCode).toBe(500);
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('serializes to JSON correctly', () => {
      const error = new AppError('Test error', 'TEST_ERROR', undefined, true, 500);
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'AppError',
        message: 'Test error',
        code: 'TEST_ERROR',
        retry: true,
        statusCode: 500,
        stack: error.stack,
      });
    });

    it('handles original error correctly', () => {
      const originalError = new Error('Original error');
      const error = new AppError('Test error', 'TEST_ERROR', originalError);

      expect(error.originalError).toBe(originalError);
    });
  });

  describe('Specialized Error Classes', () => {
    it('creates NetworkError correctly', () => {
      const error = new NetworkError('Network error', undefined, 503);

      expect(error.message).toBe('Network error');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.retry).toBe(true);
      expect(error.statusCode).toBe(503);
      expect(error instanceof NetworkError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('creates ValidationError correctly', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.retry).toBe(false);
      expect(error.statusCode).toBe(400);
      expect(error instanceof ValidationError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('creates AuthError correctly', () => {
      const error = new AuthError('Unauthorized');

      expect(error.message).toBe('Unauthorized');
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.retry).toBe(true);
      expect(error.statusCode).toBe(401);
      expect(error instanceof AuthError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('creates PermissionError correctly', () => {
      const error = new PermissionError('Forbidden');

      expect(error.message).toBe('Forbidden');
      expect(error.code).toBe('PERMISSION_ERROR');
      expect(error.retry).toBe(false);
      expect(error.statusCode).toBe(403);
      expect(error instanceof PermissionError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('creates NotFoundError correctly', () => {
      const error = new NotFoundError('Resource not found');

      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe('NOT_FOUND_ERROR');
      expect(error.retry).toBe(false);
      expect(error.statusCode).toBe(404);
      expect(error instanceof NotFoundError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('creates RateLimitError correctly', () => {
      const error = new RateLimitError('Too many requests');

      expect(error.message).toBe('Too many requests');
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.retry).toBe(true);
      expect(error.statusCode).toBe(429);
      expect(error instanceof RateLimitError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });
  });

  describe('Error Type Guards', () => {
    it('identifies AppError correctly', () => {
      const appError = new AppError('Test error', 'TEST_ERROR');
      const regularError = new Error('Regular error');

      expect(isAppError(appError)).toBe(true);
      expect(isAppError(regularError)).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError({ message: 'Fake error' })).toBe(false);
    });

    it('identifies retryable errors correctly', () => {
      const networkError = new NetworkError('Network error');
      const validationError = new ValidationError('Invalid input');
      const regularError = new Error('Regular error');

      expect(shouldRetry(networkError)).toBe(true);
      expect(shouldRetry(validationError)).toBe(false);
      expect(shouldRetry(regularError)).toBe(false);
      expect(shouldRetry(null)).toBe(false);
      expect(shouldRetry(undefined)).toBe(false);
    });
  });
}); 