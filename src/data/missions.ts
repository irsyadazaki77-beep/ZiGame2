import { DailyMission, GameStats } from '../types';

export const getTodayDateString = (): string => {
  return new Date().toLocaleDateString('en-CA');
};

export const generateDailyMissions = (games: GameStats[]): DailyMission[] => {
  const date = getTodayDateString();
  const seed = new Date().getDate(); 
  
  const missions: DailyMission[] = [];
  
  // Mission 1: Specific game challenge (more meaningful than just 'play')
  if (games.length > 0) {
    const gameIdx = seed % games.length;
    const selectedGame = games[gameIdx];
    const target = 50 + (seed % 3) * 50; // 50, 100, 150
    missions.push({
      id: `m_${date}_1`,
      type: 'score_target',
      target: target,
      progress: 0,
      rewardCoins: target,
      completed: false,
      gameId: selectedGame.id,
      description: `Buktikan keahlian: Raih skor ${target} di ${selectedGame.title}`,
      date
    });
  }

  // Mission 2: Beat High Score (simulated by checking if highscore changes during the day)
  missions.push({
    id: `m_${date}_2`,
    type: 'unique_games', // We'll just hijack this type and handle it in App.tsx as 'beat_highscore'
    target: 1,
    progress: 0,
    rewardCoins: 100,
    completed: false,
    description: `Lampaui batas: Pecahkan rekor tertinggi Anda di game apa pun hari ini`,
    date
  });

  // Mission 3: Consistency
  missions.push({
    id: `m_${date}_3`,
    type: 'play_count', // We'll use this for playing different genres
    target: 3,
    progress: 0,
    rewardCoins: 50,
    completed: false,
    description: `Jelajahi dunia: Mainkan 3 genre game yang berbeda`,
    date
  });

  return missions;
};
