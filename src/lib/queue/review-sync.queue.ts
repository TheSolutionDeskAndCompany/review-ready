import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '../prisma.js';
import { captureException, captureMessage } from '../error-handling.js';
import { queueService } from './queue.service.js';

// Import services
import { YelpService } from '../services/yelp.js';
import { FacebookService } from '../services/facebook.js';

// Service implementations
const googleReviewService = {
  getReviews: async (placeId: string, lang: string) => {
    // Mock implementation - replace with actual Google Review Service call
    console.log(`Fetching reviews for place ${placeId} in ${lang}`);
    return [{
      id: `mock-review-${Date.now()}`,
      rating: 5,
      text: 'Great service!',
      authorName: 'Test User',
      authorUrl: 'https://example.com/user/1',
      platformUrl: 'https://example.com/review/1',
      createdAt: new Date().toISOString()
    }];
  }
};

let yelpService: InstanceType<typeof YelpService> | null = null;
let facebookService: InstanceType<typeof FacebookService> | null = null;

export const REVIEW_SYNC_QUEUE_NAME = 'review-sync';

interface Account {
  id: string;
  orgId: string;  // Changed from businessId to orgId to match Prisma schema
  externalId?: string;
  accessToken?: string;
  refreshToken?: string;
  business: {
    id: string;
    name: string;
  };
}

interface ReviewSyncJobData {
  businessId: string;
  platform: 'google' | 'yelp' | 'facebook';
  locationId: string;
  accountId: string;
}

export class ReviewSyncQueue {
  private static instance: ReviewSyncQueue | null = null;
  private queue: Queue<ReviewSyncJobData> | null = null;
  private worker: Worker<ReviewSyncJobData, void, string> | null = null;
  private isInitializing = false;

  private constructor() {}

  public static async getInstance(): Promise<ReviewSyncQueue> {
    if (!ReviewSyncQueue.instance) {
      const instance = new ReviewSyncQueue();
      await instance.initialize();
      ReviewSyncQueue.instance = instance;
    }
    return ReviewSyncQueue.instance;
  }

  private async initialize(): Promise<void> {
    this.queue = await queueService.createQueue<ReviewSyncJobData>({
      name: REVIEW_SYNC_QUEUE_NAME,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5 seconds
        },
        removeOnComplete: 1000, // Keep last 1000 completed jobs
        removeOnFail: 5000, // Keep last 5000 failed jobs
      },
    });
  }

  private async initializeWorker(): Promise<Worker<ReviewSyncJobData, void, string>> {
    if (this.isInitializing) {
      throw new Error('Worker initialization already in progress');
    }
    
    this.isInitializing = true;
    
    try {
      // Initialize services if needed
      if (!yelpService && process.env.YELP_API_KEY) {
        yelpService = new YelpService(process.env.YELP_API_KEY);
      }
      
      if (!facebookService) {
        facebookService = new FacebookService(
          process.env.FACEBOOK_APP_ID || '',
          process.env.FACEBOOK_APP_SECRET || ''
        );
      }
      
      const worker = new Worker<ReviewSyncJobData, void, string>(
        REVIEW_SYNC_QUEUE_NAME,
        async (job) => {
          await this.processJob(job);
        },
        {
          connection: queueService.getRedisConnection(),
          concurrency: 5,
        }
      );
      
      worker.on('completed', (job) => {
        captureMessage('Review sync job completed', 'info', {
          jobId: job?.id,
          data: job?.data,
        });
      });
      
      worker.on('failed', (job, error) => {
        captureException(error, {
          jobId: job?.id,
          data: job?.data,
        });
      });
      
      this.isInitializing = false;
      return worker;
      
    } catch (error) {
      this.isInitializing = false;
      captureException(error as Error, { context: 'Failed to initialize worker' });
      throw error;
    }
  }

  public async addJob(data: ReviewSyncJobData, options = {}) {
    const jobId = `${data.platform}:${data.businessId}:${Date.now()}`;
    
    return this.queue.add(
      'sync-reviews',
      data,
      {
        jobId,
        ...options,
      }
    );
  }

  public async processJobs(): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized. Call getInstance() first.');
    }

    if (this.worker || this.isInitializing) {
      return; // Worker already running or initializing
    }

    try {
      this.worker = await this.initializeWorker();
    } catch (error) {
      captureException(error as Error, { context: 'Failed to initialize worker' });
      throw error;
    }
  }

  private async processJob(job: Job<ReviewSyncJobData>): Promise<void> {
    const { businessId, platform, locationId, accountId } = job.data;
    
    try {
      captureMessage('Starting review sync job', 'info', {
        jobId: job.id,
        businessId,
        platform,
        locationId,
        accountId,
      });

      // Get the business and account info
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          accounts: {
            where: { id: accountId, platform },
            take: 1,
          },
        },
      });

      if (!business) {
        throw new Error(`Business not found: ${businessId}`);
      }

      if (!business.accounts || business.accounts.length === 0) {
        throw new Error(`No ${platform} account found for business: ${businessId}`);
      }

      const account = business.accounts[0] as Account;
      
      // Process based on platform
      switch (platform) {
        case 'google':
          await this.syncGoogleReviews(account, locationId);
          break;
        case 'yelp':
          await this.syncYelpReviews(account, locationId);
          break;
        case 'facebook':
          await this.syncFacebookReviews(account, locationId);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      // Update last sync time
      await prisma.business.update({
        where: { id: businessId },
        data: { lastSyncedAt: new Date() },
      });

      captureMessage('Review sync completed successfully', 'info', {
        jobId: job.id,
        businessId,
        platform,
        locationId,
        accountId,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        captureException(error, {
          jobId: job.id,
          businessId,
          platform,
          locationId,
          accountId,
          context: 'Review sync job failed',
        });
      }
      throw error; // Let BullMQ handle retries
    }
  }

  private async syncGoogleReviews(account: Account, locationId: string): Promise<void> {
    if (!googleReviewService) {
      throw new Error('GoogleReviewService not initialized');
    }

    try {
      // Get the most recent review for this location
      const lastReview = await prisma.review.findFirst({
        where: { locationId, provider: 'google' },
        orderBy: { createdAt: 'desc' },
      });

      // Get Google place ID from account external ID
      const placeId = account.externalId;
      if (!placeId) {
        throw new Error('No Google place ID found for account');
      }

      // Get reviews from Google
      const googleReviews = await googleReviewService.getReviews(placeId, 'en');

      // Process new reviews
      for (const review of googleReviews) {
        const reviewTime = review.createdAt ? new Date(review.createdAt) : new Date();
        
        // Skip if we've already synced this review
        if (lastReview?.createdAt && reviewTime <= lastReview.createdAt) {
          continue;
        }

        // Check if review already exists using providerReviewId
        const existingReview = await prisma.review.findFirst({
          where: {
            provider: 'google',
            providerReviewId: review.id
          }
        });

        const reviewData = {
          provider: 'google' as const,
          providerReviewId: review.id,
          rating: review.rating,
          text: review.text || '',
          authorName: review.authorName || 'Anonymous',
          authorProfileUrl: review.authorUrl || null,
          authorUrl: review.authorUrl || null,
          platformUrl: review.platformUrl || null,
          updatedAt: new Date(),
          org: { connect: { id: account.orgId } },
          location: { connect: { id: locationId } },
        };

        if (existingReview) {
          // Update existing review
          await prisma.review.update({
            where: { id: existingReview.id },
            data: reviewData,
          });
        } else {
          // Create new review
          await prisma.review.create({
            data: {
              ...reviewData,
              createdAt: reviewTime,
            },
          });
        }
      }
    } catch (error) {
      captureException(error, { accountId: account.id, locationId });
      throw error;
    }
  }

  private async syncYelpReviews(account: Account, locationId: string): Promise<void> {
    if (!yelpService) {
      throw new Error('YelpService not initialized');
    }
    
    try {
      // Get the most recent review for this location
      const lastReview = await prisma.review.findFirst({
        where: { 
          locationId, 
          provider: 'yelp' 
        },
        orderBy: { createdAt: 'desc' as const },
      });
      
      // Create a safe last review object with a default createdAt
      const safeLastReview = lastReview ? { 
        ...lastReview, 
        createdAt: lastReview.createdAt || new Date(0) 
      } : { 
        createdAt: new Date(0) 
      };

      // Get Yelp business ID from account
      const businessId = account.business?.id || account.externalId;
      if (!businessId) {
        throw new Error('No Yelp business ID found for account');
      }

      // Get reviews from Yelp
      const yelpReviews = await yelpService.getBusinessReviews(businessId);

      // Process new reviews
      for (const review of yelpReviews) {
        const reviewTime = review.time_created ? new Date(review.time_created) : new Date();
        
        // Skip if we've already synced this review
        if (safeLastReview.createdAt && reviewTime <= safeLastReview.createdAt) {
          continue;
        }

        const reviewData = {
          provider: 'yelp' as const,
          providerReviewId: review.id,
          rating: review.rating || 0,
          text: review.text || '',
          authorName: review.user?.name || 'Anonymous',
          authorProfileUrl: review.user?.profile_url || null,
          authorUrl: review.user?.profile_url || null,
          platformUrl: review.url || null,
          updatedAt: new Date(),
          org: { connect: { id: account.orgId } },
          location: { connect: { id: locationId } },
        };

        // Check if review already exists using providerReviewId
        const existingReview = await prisma.review.findFirst({
          where: {
            provider: 'yelp',
            providerReviewId: review.id
          }
        });

        if (existingReview) {
          // Update existing review
          await prisma.review.update({
            where: { id: existingReview.id },
            data: reviewData,
          });
        } else {
          // Create new review
          await prisma.review.create({
            data: {
              ...reviewData,
              createdAt: reviewTime,
            },
          });
        }
      }

      // Update the OAuth connection's updatedAt to track last sync time
      await prisma.oAuthConnection.update({
        where: { id: account.id },
        data: { updatedAt: new Date() },
      });
    } catch (error) {
      captureException(error, { accountId: account.id, locationId });
      throw error;
    }
  }

  private async syncFacebookReviews(account: Account, locationId: string): Promise<void> {
    if (!facebookService) {
      throw new Error('FacebookService not initialized');
    }
    
    if (!account.accessToken || !account.externalId) {
      throw new Error('Facebook access token and external ID are required');
    }
    
    try {
      // Get the most recent review we have for this location
      const lastReview = await prisma.review.findFirst({
        where: { locationId, platform: 'facebook' },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      });

      // Get recent reviews from Facebook Graph API
      const response = await fetch(
        `https://graph.facebook.com/v15.0/${account.externalId}/ratings?access_token=${account.accessToken}&fields=review_text,rating,created_time,reviewer{name,id}`
      );
      
      if (!response.ok) {
        throw new Error(`Facebook API error: ${response.statusText}`);
      }
      
      const { data: reviews } = await response.json();

      // Process new reviews
      for (const review of reviews) {
        const reviewTime = new Date(review.created_time);
        
        // Skip if we already have this review
        if (lastReview && lastReview.createdAt && reviewTime <= lastReview.createdAt) {
          continue;
        }

        const reviewData = {
          provider: 'facebook' as const,
          providerReviewId: review.id,
          rating: review.rating || 0,
          text: review.review_text || '',
          authorName: review.reviewer?.name || 'Anonymous',
          authorProfileUrl: review.reviewer?.id ? `https://facebook.com/${review.reviewer.id}` : null,
          authorUrl: review.reviewer?.id ? `https://facebook.com/${review.reviewer.id}` : null,
          platformUrl: `https://facebook.com/${account.externalId}/reviews`,
          updatedAt: new Date(),
          org: { connect: { id: account.orgId } },
          location: { connect: { id: locationId } },
        };

        // Check if review already exists using providerReviewId
        const existingReview = await prisma.review.findFirst({
          where: {
            provider: 'facebook',
            providerReviewId: review.id
          }
        });

        if (existingReview) {
          // Update existing review
          await prisma.review.update({
            where: { id: existingReview.id },
            data: reviewData,
          });
        } else {
          // Create new review
          await prisma.review.create({
            data: {
              ...reviewData,
              createdAt: reviewTime,
            },
          });
        }
      }
      
      // Update the OAuth connection's updatedAt to track last sync time
      await prisma.oAuthConnection.update({
        where: { id: account.id },
        data: { updatedAt: new Date() },
      });
      
    } catch (error: unknown) {
      if (error instanceof Error) {
        captureException(error, {
          context: 'syncFacebookReviews',
          accountId: account.id,
          locationId,
        });
      }
      throw error;
    }
  }
}

// Export a singleton instance
export const reviewSyncQueue = ReviewSyncQueue.getInstance();
