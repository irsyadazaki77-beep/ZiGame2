export type RelationshipStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS' | 'BLOCKED';

export interface FriendProfile {
  uid: string;
  name: string;
  avatar: string;
  colorTheme: string;
  status: RelationshipStatus;
  isOnline?: boolean;
  lastActive?: number;
  highestScoreGame?: {
    gameTitle: string;
    score: number;
  };
  masteryTitle?: string;
}

export interface ActivityFeedItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: 'high_score' | 'mastery_up' | 'achievement' | 'challenge_clear';
  gameTitle?: string;
  score?: number;
  details: string;
  timestamp: number;
}
