#!/usr/bin/env node
/**
 * Worker process for handling background jobs
 */
import 'dotenv/config';
import { reviewSyncQueue } from '../src/lib/queue/review-sync.queue';
import { queueService } from '../src/lib/queue/queue.service';
import { captureMessage } from '../src/lib/error-handling';

// Handle process termination
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  
  try {
    await queueService.closeAll();
    console.log('All queues and workers have been closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle different termination signals
const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
signals.forEach(signal => {
  process.on(signal, () => {
    console.log(`Received ${signal}`);
    shutdown(signal);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  captureMessage('Uncaught exception in worker', 'error', { error: error.message });
  // Don't exit, let the process continue
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  captureMessage('Unhandled promise rejection in worker', 'error', { 
    reason: reason instanceof Error ? reason.message : String(reason) 
  });
  // Don't exit, let the process continue
});

// Start the worker
const startWorker = async () => {
  try {
    console.log('Starting review sync worker...');
    captureMessage('Starting review sync worker', 'info');
    
    // Start processing review sync jobs
    await reviewSyncQueue.processJobs();
    
    console.log('Review sync worker is running');
    captureMessage('Review sync worker is running', 'info');
    
    // Keep the process alive
    setInterval(() => {
      // This keeps the process alive
    }, 1000 * 60 * 60); // 1 hour
    
  } catch (error) {
    console.error('Failed to start worker:', error);
    captureMessage('Failed to start worker', 'error', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  }
};

// Start the worker
startWorker();
