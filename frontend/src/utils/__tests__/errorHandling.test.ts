import {
  withRetry,
  processError,
  createErrorHandler,
  withErrorHandling,
  RetryOptions
} from '../errorHandling';
import { AppError, NetworkError } from '../errors';

describe('Error Handling Utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('withRetry', () => {
    it.skip('returns successful operation result without retrying', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = withRetry(operation);

      await expect(result).resolves.toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it.skip('retries failed operations with exponential backoff', async () => {
      const error = new NetworkError('Network error');
      const operation = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const retryPromise = withRetry(operation);
      
      // First attempt fails
      await jest.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // Second attempt after delay
      await jest.advanceTimersByTimeAsync(1000);
      expect(operation).toHaveBeenCalledTimes(2);

      // Third attempt succeeds
      await jest.advanceTimersByTimeAsync(2000);
      await expect(retryPromise).resolves.toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it.skip('respects custom retry options', async () => {
      const error = new NetworkError('Network error');
      const operation = jest
        .fn()
        .mockRejectedValue(error);

      const options: RetryOptions = {
        maxRetries: 2,
        initialDelay: 500,
        maxDelay: 1000,
        backoffFactor: 2
      };

      const retryPromise = withRetry(operation, options);

      // First attempt
      await jest.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // Second attempt after 500ms
      await jest.advanceTimersByTimeAsync(500);
      expect(operation).toHaveBeenCalledTimes(2);

      // Third attempt after 1000ms (maxDelay)
      await jest.advanceTimersByTimeAsync(1000);
      expect(operation).toHaveBeenCalledTimes(3);

      await expect(retryPromise).rejects.toThrow(error);
    });
  });

  describe('processError', () => {
    it('returns AppError as is', () => {
      const originalError = new AppError('Original error', 'TEST_ERROR');
      const processedError = processError(originalError);

      expect(processedError).toBe(originalError);
    });

    it('converts Error to AppError', () => {
      const originalError = new Error('Test error');
      const processedError = processError(originalError);

      expect(processedError).toBeInstanceOf(AppError);
      expect(processedError.message).toBe('Test error');
      expect(processedError.originalError).toBe(originalError);
    });

    it('converts network TypeError to NetworkError', () => {
      const originalError = new TypeError('Failed to fetch: network error');
      const processedError = processError(originalError);

      expect(processedError).toBeInstanceOf(NetworkError);
      expect(processedError.originalError).toBe(originalError);
    });

    it('handles non-Error objects', () => {
      const processedError = processError({ custom: 'error' });

      expect(processedError).toBeInstanceOf(AppError);
      expect(processedError.message).toBe('An unexpected error occurred');
    });

    it('handles string errors', () => {
      const processedError = processError('Something went wrong');

      expect(processedError).toBeInstanceOf(AppError);
      expect(processedError.message).toBe('Something went wrong');
    });
  });

  describe('createErrorHandler', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    afterEach(() => {
      consoleError.mockClear();
    });

    it('creates handler that logs and returns processed error', () => {
      const handler = createErrorHandler('TestContext');
      const error = new Error('Test error');
      const processedError = handler(error);

      expect(processedError).toBeInstanceOf(AppError);
      expect(consoleError).toHaveBeenCalledWith(
        'Error in TestContext:',
        expect.any(AppError)
      );
    });
  });

  describe('withErrorHandling', () => {
    it('returns successful operation result', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await withErrorHandling(operation, 'TestContext');

      expect(result).toBe('success');
    });

    it('processes and throws errors with context', async () => {
      const error = new Error('Test error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(withErrorHandling(operation, 'TestContext'))
        .rejects
        .toThrow(AppError);
    });
  });
}); 