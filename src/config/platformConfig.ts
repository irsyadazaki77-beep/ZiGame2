export interface PlatformDynamicConfig {
  featuredGameIds: string[];
  bannerNotice: {
    enabled: boolean;
    type: 'info' | 'event' | 'maintenance';
    message: string;
    actionText?: string;
    actionLink?: string;
  };
  globalXpMultiplier: number;
  globalCoinMultiplier: number;
  maintenanceMode: boolean;
  minSupportedClientVersion: string;
  currentPlatformBalanceVersion: string;
}

export const PLATFORM_CONFIG: PlatformDynamicConfig = {
  featuredGameIds: ['snake', 'space', 'brick', 'runner', 'racer', 'pong', 'dinorun', 'tetris'],
  bannerNotice: {
    enabled: false,
    type: 'event',
    message: '⚡ Turnamen Arkade Cyber Musim 2 sedang berlangsung! Dapatkan 1.5x Mastery XP.',
    actionText: 'Lihat Leaderboard',
    actionLink: '/leaderboard'
  },
  globalXpMultiplier: 1.0,
  globalCoinMultiplier: 1.0,
  maintenanceMode: false,
  minSupportedClientVersion: '2.0.0',
  currentPlatformBalanceVersion: '2.1.0'
};
