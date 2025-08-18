import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { captureException, captureMessage } from '@/lib/error-handling';

// List of paths to exclude from monitoring
const EXCLUDED_PATHS = [
  '/_next',
  '/favicon.ico',
  '/api/health',
  '/api/auth',
];

export async function performanceMonitoringMiddleware(request: NextRequest) {
  // Skip monitoring for excluded paths
  if (EXCLUDED_PATHS.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const start = Date.now();
  let response: NextResponse | null = null;
  let error: Error | null = null;

  try {
    // Process the request
    response = await NextResponse.next();
    return response;
  } catch (err) {
    error = err as Error;
    throw error;
  } finally {
    const responseTime = Date.now() - start;
    
    // Log all API requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[${request.method}] ${request.nextUrl.pathname} - ${response?.status || 'error'} (${responseTime}ms)`
      );
    }

    // Log slow requests
    if (response && responseTime > 2000) { // 2 seconds threshold
      captureMessage(
        `Slow API response: ${request.method} ${request.nextUrl.pathname} (${responseTime}ms)`,
        'warning',
        {
          method: request.method,
          url: request.url,
          responseTime,
          status: response.status,
          userAgent: request.headers.get('user-agent'),
        },
        { type: 'performance', endpoint: request.nextUrl.pathname }
      );
    }

    // Log any errors that occurred
    if (error) {
      captureException(error, {
        request: {
          method: request.method,
          url: request.url,
          headers: Object.fromEntries(request.headers.entries()),
        },
        responseTime,
      }, { type: 'api_error', endpoint: request.nextUrl.pathname });
    }
  }
  // Return the response if it exists, otherwise create a new one
  return response || NextResponse.next();
}

// Helper function to measure execution time of a function
export async function measureExecutionTime<T>(
  fn: () => Promise<T>,
  context: string
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    // Log slow operations
    if (duration > 1000) { // 1 second threshold
      captureMessage(
        `Slow operation: ${context} (${duration}ms)`,
        'warning',
        { context, duration },
        { type: 'performance', operation: context }
      );
    }
    
    return { result, duration };
  } catch (error) {
    const duration = Date.now() - start;
    captureException(error, { context, duration, failedAfterMs: duration });
    throw error;
  }
}
