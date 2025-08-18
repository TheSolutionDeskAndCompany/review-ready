import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  tracesSampleRate: 0.1,
  
  // Capture Replay for error sessions
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Integrations
  integrations: [
    new Sentry.Replay(),
    new Sentry.BrowserTracing({
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: [
        "localhost",
        /^https?:\/\/.*\.yourdomain\.com\//,
      ],
    }),
  ],
  
  // Filter out health check transactions
  beforeSend(event) {
    // Don't send errors from health check endpoints
    if (event.request?.url?.includes('/api/health')) {
      return null;
    }
    return event;
  },
  
  // Filter out console logs in development
  beforeBreadcrumb(breadcrumb) {
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    return breadcrumb;
  },
});
