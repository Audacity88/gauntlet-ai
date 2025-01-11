import { AppError, NetworkError, isAppError, shouldRetry } from './errors';

/**
 * Options for retry operations
 */
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  shouldRetry: (error: unknown) => shouldRetry(error),
};

/**
 * Retry an operation with exponential backoff
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
    }
  }

  // This should never happen due to the throw in the loop
  throw lastError;
};

/**
 * Process an error and convert it to an AppError
 */
export const processError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Handle specific error types
    if (error.name === 'TypeError' && error.message.includes('network')) {
      return new NetworkError('Network request failed', error);
    }

    return new AppError(
      error.message || 'An unexpected error occurred',
      'UNKNOWN_ERROR',
      error,
      false
    );
  }

  return new AppError(
    typeof error === 'string' ? error : 'An unexpected error occurred',
    'UNKNOWN_ERROR',
    undefined,
    false
  );
};

/**
 * Create an error handler function with context
 */
export const createErrorHandler = (context: string) => {
  return (error: unknown): AppError => {
    const processedError = processError(error);
    // Here you could add logging, error reporting, etc.
    console.error(`Error in ${context}:`, processedError);
    return processedError;
  };
};

/**
 * Wrap an async operation with error handling
 */
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    throw createErrorHandler(context)(error);
  }
}; 