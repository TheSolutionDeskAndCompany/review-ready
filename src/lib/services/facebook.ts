import { FacebookReview } from "@/lib/types/facebook";

export class FacebookService {
  private accessToken: string;
  private pageId: string;

  constructor(accessToken: string, pageId: string) {
    this.accessToken = accessToken;
    this.pageId = pageId;
  }

  /**
   * Generate a deep link to the Facebook page's reviews
   */
  getReviewsDeepLink(): string {
    return `https://www.facebook.com/${this.pageId}/reviews`;
  }

  /**
   * Generate a deep link to reply to a specific review
   */
  getReplyDeepLink(reviewId: string): string {
    return `https://business.facebook.com/latest/reviews?asset_id=${reviewId}&comment_id=0`;
  }

  /**
   * Format review data from Facebook's API to our internal format
   */
  static formatReview(review: FacebookReview, pageId: string, locationId: string) {
    // Use the first available URL from possible locations
    const platformUrl = review.open_graph_story?.target?.url || 
                       `https://facebook.com/${review.id}`;
    
    // Use updated_at if available, otherwise fall back to created_time
    const updatedAt = review.updated_at ? 
                     new Date(review.updated_at) : 
                     new Date(review.created_time);

    return {
      id: `facebook-${review.id}`,
      text: review.review_text || '',
      rating: review.rating || 0,
      authorName: review.reviewer?.name || 'Anonymous',
      authorUrl: review.reviewer?.link || '',
      platform: 'facebook',
      platformReviewId: review.id,
      platformUrl,
      createdAt: new Date(review.created_time),
      updatedAt,
      businessId: pageId,
      locationId,
    };
  }

  /**
   * Get a list of recent reviews (stub - would use Facebook Graph API with proper permissions)
   * @param _limit - Maximum number of reviews to return (unused in stub implementation)
   */
  async getRecentReviews(_limit = 10): Promise<FacebookReview[]> {
    // In a real implementation, this would call the Facebook Graph API
    // For now, we'll return an empty array since we can't fetch without user authentication
    return [];
  }
}
