import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { captureException } from '../error-handling';

type JobHandler<T = unknown, R = unknown> = (job: Job<T, R>) => Promise<R>;

interface QueueConfig<T = unknown, R = unknown> {
  name: string;
  concurrency?: number;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
  };
}

export class QueueService {
  private static instance: QueueService;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private redis: Redis;

  private constructor() {
    // Initialize Redis connection
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    // Handle Redis connection errors
    this.redis.on('error', (error) => {
      captureException(error, { context: 'Redis connection error' });
    });
  }

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Get the Redis connection instance
   */
  public getRedisConnection() {
    return this.redis.duplicate();
  }

  public async createQueue<T = unknown, R = unknown>({
    name,
    concurrency = 1,
    defaultJobOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5 seconds
      },
      removeOnComplete: 1000, // Keep last 1000 completed jobs
      removeOnFail: 5000, // Keep last 5000 failed jobs
    },
  }: QueueConfig<T, R>): Promise<Queue<T, R>> {
    if (this.queues.has(name)) {
      return this.queues.get(name) as Queue<T, R>;
    }

    const queue = new Queue<T, R>(name, {
      connection: this.redis,
      defaultJobOptions,
    });

    // Create queue events
    const queueEvents = new QueueEvents(name, { connection: this.redis });

    // Store references
    this.queues.set(name, queue);
    this.queueEvents.set(name, queueEvents);

    // Set up event listeners
    this.setupQueueEventListeners(queue, queueEvents);

    return queue;
  }

  public async createWorker<T = unknown, R = unknown>(
    queueName: string,
    handler: JobHandler<T, R>,
    concurrency = 1
  ): Promise<Worker<T, R>> {
    if (this.workers.has(queueName)) {
      return this.workers.get(queueName) as Worker<T, R>;
    }

    const worker = new Worker<T, R>(
      queueName,
      async (job) => {
        try {
          return await handler(job);
        } catch (error) {
          captureException(error, {
            jobId: job.id,
            queue: queueName,
            data: job.data,
          });
          throw error; // Let BullMQ handle retries
        }
      },
      {
        connection: this.redis,
        concurrency,
      }
    );

    // Store the worker
    this.workers.set(queueName, worker);

    // Set up worker event listeners
    this.setupWorkerEventListeners(worker);

    return worker;
  }

  private setupQueueEventListeners<T, R>(
    queue: Queue<T, R>,
    queueEvents: QueueEvents
  ): void {
    // Queue events
    queue.on('error', (error) => {
      captureException(error, { queue: queue.name, context: 'Queue error' });
    });

    // Queue events
    queueEvents.on('error', (error) => {
      captureException(error, { queue: queue.name, context: 'Queue events error' });
    });

    // Job completed
    queueEvents.on('completed', (job) => {
      console.log(`[Queue ${queue.name}] Job ${job.jobId} completed`);
    });

    // Job failed
    queueEvents.on('failed', (jobId, error) => {
      captureException(error, {
        jobId,
        queue: queue.name,
        context: 'Job failed',
      });
    });
  }

  private setupWorkerEventListeners<T, R>(worker: Worker<T, R>): void {
    worker.on('active', (job) => {
      console.log(`[Worker ${worker.name}] Processing job ${job.id}`);
    });

    worker.on('completed', (job) => {
      console.log(`[Worker ${worker.name}] Job ${job.id} completed`);
    });

    worker.on('failed', (job, error) => {
      if (job) {
        console.error(
          `[Worker ${worker.name}] Job ${job.id} failed: ${error.message}`
        );
      } else {
        console.error(`[Worker ${worker.name}] Job failed: ${error.message}`);
      }
    });

    worker.on('error', (error) => {
      captureException(error, {
        worker: worker.name,
        context: 'Worker error',
      });
    });
  }

  public async closeAll(): Promise<void> {
    // Close all workers
    for (const [name, worker] of this.workers.entries()) {
      try {
        await worker.close();
        console.log(`Worker ${name} closed`);
      } catch (error) {
        captureException(error, { worker: name, context: 'Error closing worker' });
      }
    }

    // Close all queues
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
        console.log(`Queue ${name} closed`);
      } catch (error) {
        captureException(error, { queue: name, context: 'Error closing queue' });
      }
    }

    // Close all queue events
    for (const [name, queueEvents] of this.queueEvents.entries()) {
      try {
        await queueEvents.close();
        console.log(`Queue events ${name} closed`);
      } catch (error) {
        captureException(error, { queue: name, context: 'Error closing queue events' });
      }
    }

    // Close Redis connection
    if (this.redis) {
      try {
        await this.redis.quit();
        console.log('Redis connection closed');
      } catch (error) {
        captureException(error, { context: 'Error closing Redis connection' });
      }
    }

    // Clear all maps
    this.queues.clear();
    this.workers.clear();
    this.queueEvents.clear();
  }

  public getQueue<T = unknown, R = unknown>(name: string): Queue<T, R> | undefined {
    return this.queues.get(name) as Queue<T, R> | undefined;
  }

  public getWorker<T = unknown, R = unknown>(name: string): Worker<T, R> | undefined {
    return this.workers.get(name) as Worker<T, R> | undefined;
  }
}

// Export a singleton instance
export const queueService = QueueService.getInstance();
