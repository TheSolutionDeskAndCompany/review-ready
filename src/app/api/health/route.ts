import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { captureMessage } from '@/lib/error-handling';

export async function GET() {
  const healthcheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || 'unknown',
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Log health check (sampled to avoid log spam)
    if (Math.random() < 0.01) { // Sample 1% of health checks
      captureMessage('Health check', 'info', {
        ...healthcheck,
        sampled: true,
      }, { type: 'health_check' });
    }
    
    return NextResponse.json(healthcheck);
  } catch (error) {
    // Update health check status
    healthcheck.status = 'error';
    healthcheck.database.status = 'error';
    
    // Log the error
    captureMessage('Health check failed', 'error', {
      ...healthcheck,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { type: 'health_check' });
    
    return NextResponse.json(healthcheck, { status: 503 });
  }
}
