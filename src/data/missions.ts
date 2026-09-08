import { DailyMission, GameStats } from '../types';

// Use UTC for daily reset to prevent local clock manipulation
export const getTodayDateString = (): string => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

// Seeded random number generator
function sfc32(a: number, b: number, c: number, d: number) {
  return function() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
    let t = (a + b) | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    d = d + 1 | 0;
    t = t + d | 0;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}

export const generateDailyMissions = (games: GameStats[]): DailyMission[] => {
  const date = getTodayDateString();
  
  // Create a seed based on the date string
  let seedNum = 0;
  for (let i = 0; i < date.length; i++) {
    seedNum += date.charCodeAt(i) * Math.pow(10, i % 3);
  }
  const rand = sfc32(seedNum, seedNum * 2, seedNum * 3, 1);

  const missions: DailyMission[] = [];
  
  // Mission 1: Specific game challenge
  if (games.length > 0) {
    const gameIdx = Math.floor(rand() * games.length);
    const selectedGame = games[gameIdx];
    // Vary the target
    const targetScore = 500 + Math.floor(rand() * 5) * 500;
    missions.push({
      id: `m_${date}_1`,
      type: 'score_target',
      target: targetScore,
      progress: 0,
      rewardCoins: 100,
      completed: false,
      gameId: selectedGame.id,
      description: `Raih skor minimal ${targetScore} di game ${selectedGame.title}`,
      date
    });
  }

  // Mission 2: Meaningful Engagement
  const mission2Types = ['beat_pb', 'total_score', 'play_genre_count'];
  const m2Type = mission2Types[Math.floor(rand() * mission2Types.length)];
  
  if (m2Type === 'beat_pb') {
    missions.push({
      id: `m_${date}_2`,
      type: 'beat_pb',
      target: 1,
      progress: 0,
      rewardCoins: 150,
      completed: false,
      description: 'Pecahkan Rekor (PB) di game mana saja',
      date
    });
  } else if (m2Type === 'total_score') {
    const totalScoreTarget = 10000 + Math.floor(rand() * 5) * 5000;
    missions.push({
      id: `m_${date}_2`,
      type: 'total_score',
      target: totalScoreTarget,
      progress: 0,
      rewardCoins: 120,
      completed: false,
      description: `Kumpulkan total skor ${totalScoreTarget} hari ini di semua game`,
      date
    });
  } else {
    missions.push({
      id: `m_${date}_2`,
      type: 'play_genre_count',
      target: 3,
      progress: 0,
      rewardCoins: 100,
      completed: false,
      description: 'Mainkan 3 genre game yang berbeda',
      metadata: { genresPlayed: [] },
      date
    });
  }

  // Mission 3: Consistency / Milestone
  missions.push({
    id: `m_${date}_3`,
    type: 'play_count',
    target: 5,
    progress: 0,
    rewardCoins: 80,
    completed: false,
    description: `Mainkan 5 sesi game yang valid (minimal 30 detik atau raih skor layak)`,
    date
  });

  return missions;
};
