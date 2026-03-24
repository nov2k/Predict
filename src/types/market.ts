export interface Market {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  videoUrl?: string;
  /** Polymarket admin: excluded from «Needs video» queue only */
  skipNeedsVideoQueue?: boolean;
  /** Polymarket: shown in public feed */
  publishedToFeed?: boolean;
  yesPercent: number;
  noPercent: number;
  totalPool: number;
  bettorsCount: number;
  expiresAt: string;
  userLiked?: boolean;
  userSaved?: boolean;
  priceHistory?: unknown[];
  outcomes?: string[];
  outcomePrices?: number[];
  source?: string;
  tokenIds?: string[];
  externalId?: string;
  tickSize?: string;
  negRisk?: boolean;
  _count: {
    bets: number;
    comments: number;
    likes: number;
  };
}

export interface MarketProposal {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  videoUrl?: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  user: {
    handle: string;
    avatar: string;
  };
}

export type AppView = 'feed' | 'rank' | 'create' | 'history' | 'profile' | 'saved' | 'admin';
