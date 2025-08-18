import { captureException } from '../error-handling';
import { prisma } from '../prisma';

export class GoogleReviewService {
  private static instance: GoogleReviewService;

  private constructor() {}

  public static getInstance(): GoogleReviewService {
    if (!GoogleReviewService.instance) {
      GoogleReviewService.instance = new GoogleReviewService();
    }
    return GoogleReviewService.instance;
  }

  public async getReviews(accountId: string, locationId: string) {
    try {
      // Get the account with the Google token
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: { business: true },
      });

      if (!account) {
        throw new Error(`Account not found: ${accountId}`);
      }

      // TODO: Implement actual Google API integration
      // This is a placeholder that returns mock data
      return [
        {
          id: `google-${Date.now()}`,
          authorName: 'John Doe',
          rating: 5,
          text: 'Great service!',
          time: new Date().toISOString(),
          platform: 'google',
          sourceId: locationId,
        },
      ];
    } catch (error) {
      captureException(error, {
        context: 'GoogleReviewService.getReviews',
        accountId,
        locationId,
      });
      throw error;
    }
  }
}

export const googleReviewService = GoogleReviewService.getInstance();
