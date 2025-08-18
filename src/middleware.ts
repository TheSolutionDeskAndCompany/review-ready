import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import * as Sentry from '@sentry/nextjs';
import { captureException } from '@/lib/error-handling';
import { performanceMonitoringMiddleware } from './middleware/performance-monitoring';
import type { NextRequest } from 'next/server';

// Initialize Sentry
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
});

export default async function middleware(req: NextRequest) {
  // Apply performance monitoring
  let response: NextResponse | null = null;
  
  try {
    // Get the response from performance monitoring
    response = await performanceMonitoringMiddleware(req);
    
    const token = await getToken({ req });
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith('/auth');
    const isApiAuthRoute = req.nextUrl.pathname.startsWith('/api/auth');
    const isPublicRoute = ['/pricing', '/', '/api/webhooks/stripe'].includes(req.nextUrl.pathname);

    // Allow API auth routes and public routes
    if (isApiAuthRoute || isPublicRoute) {
      return response || NextResponse.next();
    }

    // If user is not authenticated and not on an auth page, redirect to sign in
    if (!isAuth && !isAuthPage) {
      let callbackUrl = req.nextUrl.pathname;
      if (req.nextUrl.search) {
        callbackUrl += req.nextUrl.search;
      }
      const encodedCallbackUrl = encodeURIComponent(callbackUrl);
      return NextResponse.redirect(
        new URL(`/auth/signin?callbackUrl=${encodedCallbackUrl}`, req.url)
      );
    }

    // If user is authenticated and on an auth page, redirect to dashboard
    if (isAuth && isAuthPage) {
      return NextResponse.redirect(new URL('/app/dashboard', req.url));
    }

    return response || NextResponse.next();
  } catch (error) {
    // Capture any errors in the middleware
    captureException(error, {
      path: req.nextUrl.pathname,
      method: req.method,
    });
    
    // Re-throw the error to be handled by the Next.js error boundary
    throw error;
  }
}

// Configure which paths the middleware will run on
export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    '/((?!_next/static|_next/image|favicon.ico|api/health).*)',
  ],
};
