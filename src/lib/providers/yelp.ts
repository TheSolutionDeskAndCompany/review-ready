import { Review, ReviewsAdapter } from './index';

export const YelpAdapter: ReviewsAdapter = {
  async listReviews({ locationExternalId }) {
    if (!process.env.YELP_API_KEY) {
      console.warn('Yelp API key not configured');
      return [];
    }

    if (!locationExternalId) return [];
    
    try {
      const url = `https://api.yelp.com/v3/businesses/${locationExternalId}/reviews?limit=3`;
      const res = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${process.env.YELP_API_KEY}`,
          'Content-Type': 'application/json'
        },
        next: { revalidate: 3600 } // Cache for 1 hour
      });
      
      if (!res.ok) {
        const error = await res.text();
        console.error('Failed to fetch Yelp reviews:', error);
        return [];
      }
      
      const data = await res.json();
      const reviews: Review[] = (data.reviews || []).map((r: any) => ({
        id: r.id,
        provider: 'yelp',
        locationId: locationExternalId,
        rating: r.rating,
        authorName: r.user.name,
        authorUrl: r.user.profile_url,
        text: r.text,
        createdAt: r.time_created,
        updatedAt: r.time_created,
        url: r.url,
        raw: r
      }));
      
      return reviews;
    } catch (error) {
      console.error('Error in YelpAdapter.listReviews:', error);
      return [];
    }
  },

  deepLinkToReply(review) {
    // Yelp doesn't have a direct deep link for replying, so we return the review URL
    return review.url;
  }
};
