import { telemetryService, TelemetrySessionEvent } from './telemetryService';
import { GameStats } from '../types';

export interface GameBalanceReport {
  gameId: string;
  totalPlays: number;
  totalQuits: number;
  quitRatePercent: number;
  avgDurationSec: number;
  avgScore: number;
  crashCount: number;
  status: 'balanced' | 'too_hard' | 'too_easy' | 'high_quit_rate' | 'performance_alert';
  recommendations: string[];
}

export const analyzeGameBalance = (games: GameStats[]): GameBalanceReport[] => {
  const events = telemetryService.getEvents();
  const reports: GameBalanceReport[] = [];

  for (const game of games) {
    const gameEvents = events.filter((e) => e.gameId === game.id);
    const startEvents = gameEvents.filter((e) => e.eventType === 'start');
    const overEvents = gameEvents.filter((e) => e.eventType === 'gameover');
    const quitEvents = gameEvents.filter((e) => e.eventType === 'quit');
    const crashEvents = gameEvents.filter((e) => e.eventType === 'crash');

    const totalPlays = startEvents.length || game.plays || 0;
    const totalQuits = quitEvents.length;
    const quitRatePercent = totalPlays > 0 ? Math.round((totalQuits / totalPlays) * 100) : 0;

    const completedScores = overEvents.map((e) => e.score || 0);
    const avgScore = completedScores.length
      ? Math.round(completedScores.reduce((a, b) => a + b, 0) / completedScores.length)
      : 0;

    const durations = overEvents.map((e) => (e.durationMs || 0) / 1000);
    const avgDurationSec = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 60;

    const recommendations: string[] = [];
    let status: GameBalanceReport['status'] = 'balanced';

    if (crashEvents.length > 0) {
      status = 'performance_alert';
      recommendations.push(`Terdeteksi ${crashEvents.length} kali error runtime. Periksa lifecycle atau rendering.`);
    } else if (quitRatePercent > 45 && totalPlays >= 3) {
      status = 'high_quit_rate';
      recommendations.push('Tingkat berhenti dini tinggi. Kurangi tingkat kesulitan awal (early difficulty spike).');
    } else if (avgDurationSec < 15 && totalPlays >= 3) {
      status = 'too_hard';
      recommendations.push('Rata-rata durasi terlalu singkat (<15 detik). Berikan toleransi hitung mundur atau waktu reaksi lebih.');
    } else if (avgDurationSec > 300 && totalPlays >= 3) {
      status = 'too_easy';
      recommendations.push('Durasi sesi terlalu panjang (>5 menit). Naikkan kurva eskalasi rintangan di fase lanjut.');
    } else {
      recommendations.push('Kurva gameplay stabil dan performa normal.');
    }

    reports.push({
      gameId: game.id,
      totalPlays,
      totalQuits,
      quitRatePercent,
      avgDurationSec,
      avgScore,
      crashCount: crashEvents.length,
      status,
      recommendations
    });
  }

  return reports;
};
