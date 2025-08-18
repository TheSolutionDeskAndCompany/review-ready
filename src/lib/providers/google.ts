import { Review, ReviewsAdapter } from './index';

const GBP_API_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const GBP_MY_BUSINESS_API_BASE = 'https://mybusiness.googleapis.com/v4';

export const GoogleAdapter: ReviewsAdapter = {
  async listReviews({ accessToken, locationExternalId }) {
    if (!accessToken || !locationExternalId) return [];
    
    try {
      const url = `${GBP_MY_BUSINESS_API_BASE}/accounts/-/locations/${locationExternalId}/reviews`;
      const res = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        next: { revalidate: 60 } // Cache for 1 minute
      });
      
      if (!res.ok) {
        const error = await res.text();
        console.error('Failed to fetch Google reviews:', error);
        throw new Error(`Failed to fetch reviews: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      const reviews: Review[] = (data.reviews || []).map((r: any) => ({
        id: r.name.split('/').pop(),
        provider: 'google',
        locationId: locationExternalId,
        rating: Number(r.rating) || 0,
        authorName: r.reviewer?.displayName,
        authorUrl: r.reviewer?.profilePhotoUrl,
        text: r.comment,
        createdAt: r.createTime,
        updatedAt: r.updateTime,
        url: r.name,
        raw: r
      }));
      
      return reviews;
    } catch (error) {
      console.error('Error in GoogleAdapter.listReviews:', error);
      throw error;
    }
  },

  async reply({ accessToken, locationExternalId, reviewId, body }) {
    try {
      const url = `${GBP_MY_BUSINESS_API_BASE}/accounts/-/locations/${locationExternalId}/reviews/${reviewId}/reply`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comment: body
        })
      });

      if (!res.ok) {
        const error = await res.text();
        console.error('Failed to post Google review reply:', error);
        throw new Error(`Failed to post reply: ${res.status} ${res.statusText}`);
      }

      return { ok: true };
    } catch (error) {
      console.error('Error in GoogleAdapter.reply:', error);
      throw error;
    }
  },

  deepLinkToReply(review) {
    // Google doesn't have a direct deep link for replying, so we return the review URL
    return review.url;
  }
};
