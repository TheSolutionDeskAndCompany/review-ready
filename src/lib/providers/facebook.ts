import { Review } from './index';

export function getFacebookReviewsLink(pageUrlOrId: string): string {
  if (!pageUrlOrId) return '';
  
  // If it's a full URL, clean it up
  if (pageUrlOrId.startsWith('http')) {
    const url = new URL(pageUrlOrId);
    // Handle both facebook.com/pages/... and facebook.com/username formats
    return `https://www.facebook.com${url.pathname.replace(/\/$/, '')}/reviews/`;
  }
  
  // If it's just a page ID or username
  return `https://www.facebook.com/${pageUrlOrId}/reviews/`;
}

export const FacebookAdapter = {
  async listReviews({ pageUrlOrId }: { pageUrlOrId: string }): Promise<Review[]> {
    // Facebook Graph API v12+ doesn't support reading reviews via API for most pages
    // So we return an empty array and handle the UI to direct users to their Facebook page
    return [];
  },
  
  deepLinkToReply(review: Review): string | undefined {
    return review.url;
  }
};
