import * as Sentry from '@sentry/nextjs';
import { captureException as captureSentryException } from '@sentry/nextjs';

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    
    // Ensure the error stack is captured
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Handles errors in API routes
 */
export function handleApiError(error: unknown, context: string = 'API route') {
  // Log the error to Sentry
  captureSentryException(error, { tags: { context } });
  
  // Handle different error types
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.statusCode,
        details: error.details,
      },
    };
  }
  
  // Handle Zod validation errors
  if (error instanceof Error && error.name === 'ZodError') {
    return {
      success: false,
      error: {
        message: 'Validation error',
        code: 400,
        details: error.message,
      },
    };
  }
  
  // Handle Prisma errors
  if (error instanceof Error && error.name.startsWith('Prisma')) {
    // Don't expose database errors in production
    const message = process.env.NODE_ENV === 'production'
      ? 'A database error occurred'
      : error.message;
      
    return {
      success: false,
      error: {
        message,
        code: 500,
      },
    };
  }
  
  // Handle other errors
  const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
  
  return {
    success: false,
    error: {
      message: errorMessage,
      code: 500,
    },
  };
}

/**
 * Wraps an async function to catch and handle errors
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string = 'withErrorHandling'
) {
  return async (...args: Parameters<typeof fn>): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Log the error
      captureSentryException(error, { tags: { context } });
      
      // Re-throw the error to be handled by the Next.js error boundary
      throw error;
    }
  };
}

/**
 * Captures an exception with additional context
 */
export function captureException(
  error: unknown,
  extra?: Record<string, any>,
  tags?: Record<string, string>
) {
  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('Captured error:', error);
    if (extra) console.error('Extra context:', extra);
  }
  
  // Capture in Sentry
  return captureSentryException(error, { extra, tags });
}

/**
 * Captures a message (non-error) with additional context
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' | 'fatal' | 'debug' = 'info',
  extra?: Record<string, unknown>,
  tags?: Record<string, string>
) {
  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    const consoleLevel = level === 'fatal' || level === 'warning' ? 'error' : level;
    // @ts-expect-error - TypeScript doesn't know about dynamic console methods
    console[consoleLevel](`[${level.toUpperCase()}] ${message}`);
    if (extra) console.log('Extra context:', extra);
  }
  
  // Capture in Sentry
  return Sentry.captureMessage(message, { level, extra, tags });
}

/**
 * Helper to create a custom error
 */
export function createError(
  message: string,
  statusCode: number = 500,
  isOperational: boolean = true,
  details?: any
) {
  return new AppError(message, statusCode, isOperational, details);
}

/**
 * Helper to check if an error is an operational error
 */
export function isOperationalError(error: unknown): boolean {
  return error instanceof AppError && error.isOperational === true;
}
