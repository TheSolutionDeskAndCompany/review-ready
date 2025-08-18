import { YelpBusiness, YelpReview } from "@/lib/types/yelp";

const YELP_API_URL = "https://api.yelp.com/v3";

export class YelpService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetchFromYelp<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${YELP_API_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Yelp API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }

    return response.json();
  }

  async searchBusinesses(term: string, location: string, limit = 5): Promise<YelpBusiness[]> {
    try {
      const params = new URLSearchParams({
        term: term,
        location: location,
        limit: limit.toString(),
      });

      const data = await this.fetchFromYelp<{ businesses: YelpBusiness[] }>(
        `/businesses/search?${params}`
      );

      return data.businesses;
    } catch (error) {
      console.error('Error searching Yelp businesses:', error);
      throw error;
    }
  }

  async getBusinessDetails(businessId: string): Promise<YelpBusiness> {
    try {
      const data = await this.fetchFromYelp<YelpBusiness>(
        `/businesses/${businessId}`
      );
      return data;
    } catch (error) {
      console.error('Error fetching Yelp business details:', error);
      throw error;
    }
  }

  async getBusinessReviews(businessId: string, limit = 3): Promise<YelpReview[]> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        sort_by: 'yelp_sort',
      });

      const data = await this.fetchFromYelp<{ reviews: YelpReview[] }>(
        `/businesses/${businessId}/reviews?${params}`
      );

      return data.reviews;
    } catch (error) {
      console.error('Error fetching Yelp reviews:', error);
      throw error;
    }
  }

  // Helper method to format Yelp review data to our internal format
  static formatReview(review: YelpReview, businessId: string, locationId: string) {
    return {
      id: `yelp-${review.id}`,
      text: review.text,
      rating: review.rating,
      authorName: review.user.name,
      authorUrl: review.user.profile_url,
      platform: 'yelp',
      platformReviewId: review.id,
      platformUrl: review.url,
      createdAt: new Date(review.time_created),
      updatedAt: new Date(review.time_created),
      businessId,
      locationId,
    };
  }
}
