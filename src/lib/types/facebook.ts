// Facebook Page type
export interface FacebookPage {
  id: string;
  name: string;
  link: string;
  picture?: {
    data: {
      height: number;
      is_silhouette: boolean;
      url: string;
      width: number;
    };
  };
  category?: string;
  category_list?: Array<{
    id: string;
    name: string;
  }>;
  access_token: string;
  perms: string[];
}

// Facebook Review type
export interface FacebookReview {
  id: string;
  created_time: string;
  reviewer: {
    id: string;
    name: string;
    link: string;
  };
  rating: number;
  review_text?: string;
  open_graph_story?: {
    id: string;
    message?: string;
    type: string;
    data: {
      rating: {
        value: number;
        type: string;
        scale: number;
      };
      review_text: {
        value: string;
      };
    };
    target: {
      id: string;
      url: string;
    };
  };
  has_rating?: boolean;
  has_review?: boolean;
  review_text_has_swearing?: boolean;
  has_private_comment?: boolean;
  recommendation_type?: string;
  is_hidden?: boolean;
  is_visible?: boolean;
  is_rating_only?: boolean;
  is_user_a_guest?: boolean;
  is_verified_purchase?: boolean;
  open_graph_story_id?: string;
  open_graph_story_url?: string;
  open_graph_story_type?: string;
  created_at?: string;
  updated_at?: string;
}

// Facebook API Error response
export interface FacebookError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

// Facebook API Response for pages the user manages
export interface FacebookPagesResponse {
  data: FacebookPage[];
  paging?: {
    cursors?: {
      before: string;
      after: string;
    };
    next?: string;
    previous?: string;
  };
}
