export type Provider = 'google' | 'yelp' | 'facebook';

export interface Review {
  id: string;               // provider_review_id
  provider: Provider;
  locationId?: string;      // provider_location_id
  rating?: number;          // 1–5 when available
  authorName?: string;
  authorUrl?: string;
  text?: string;
  createdAt?: string;       // ISO
  updatedAt?: string;       // ISO
  url?: string;             // link to original
  raw?: any;                // raw provider data
}

export interface ReviewsAdapter {
  listReviews(args: { 
    accessToken?: string; 
    locationExternalId?: string; 
    since?: string 
  }): Promise<Review[]>;
  
  reply?(args: { 
    accessToken: string; 
    locationExternalId: string; 
    reviewId: string; 
    body: string 
  }): Promise<{ ok: true }>;
  
  deepLinkToReply?(review: Review): string | undefined;
}
