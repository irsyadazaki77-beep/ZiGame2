import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity, BarChart3, TrendingUp, CheckCircle, AlertTriangle, ShieldCheck, X, RefreshCw } from 'lucide-react';
import { analyticsService } from '../services/analyticsService';
import { BALANCE_VERSION, GAME_BALANCE_CONFIG, PROGRESSION_CONFIG } from '../config/balanceConfig';
import { audio } from '../utils/audio';

interface ProductAnalyticsModalProps {
  onClose: () => void;
}

export default function ProductAnalyticsModal({ onClose }: ProductAnalyticsModalProps) {
  const [metrics, setMetrics] = useState(analyticsService.getProductMetrics());
  const [activeTab, setActiveTab] = useState<'health' | 'retention' | 'balance'>('health');

  const refresh = () => {
    audio.playHit();
    setMetrics(analyticsService.getProductMetrics());
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans select-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden z-10"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <BarChart3 size={22} />
            </div>
            <div>
              <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                DIAGNOSTIK & TELEMETRI SISTEM
              </div>
              <h2 className="text-lg sm:text-xl font-display font-black text-white tracking-wider uppercase">
                PRODUCT ANALYTICS & GAME BALANCING
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="w-9 h-9 hover:bg-zinc-800 rounded-full transition flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              title="Perbarui Data"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={() => { audio.playCoin(); onClose(); }}
              className="w-9 h-9 hover:bg-zinc-800 rounded-full transition flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 py-2.5 bg-zinc-950/80 border-b border-zinc-800 flex gap-2">
          <button
            onClick={() => { audio.playHit(); setActiveTab('health'); }}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'health' ? 'bg-cyan-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Activity size={14} /> Kesehatan Game (Health Metrics)
          </button>
          <button
            onClick={() => { audio.playHit(); setActiveTab('retention'); }}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'retention' ? 'bg-cyan-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <TrendingUp size={14} /> Retensi & Engagement
          </button>
          <button
            onClick={() => { audio.playHit(); setActiveTab('balance'); }}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'balance' ? 'bg-cyan-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ShieldCheck size={14} /> Konfigurasi Balancing ({BALANCE_VERSION})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: HEALTH METRICS */}
          {activeTab === 'health' && (
            <div className="space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block">Total Game Starts</span>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    {metrics?.gameHealth.totalStarts || 0}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block">Completion Rate</span>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    {metrics?.gameHealth.completionRate || 100}%
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block">Abandon Rate</span>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                    {metrics?.gameHealth.abandonRate || 0}%
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block">Retry / Restart Rate</span>
                  <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
                    {metrics?.gameHealth.retryRate || 0}%
                  </div>
                </div>
              </div>

              {/* Per Game Breakdown */}
              <div>
                <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase mb-3">
                  Performa & Funnel Per Game
                </h3>
                {metrics?.gameHealth.gamesStats && Object.keys(metrics.gameHealth.gamesStats).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(metrics.gameHealth.gamesStats).map(([gameId, stat]: [string, any]) => {
                      const compPct = stat.starts > 0 ? Math.round((stat.completes / stat.starts) * 100) : 100;
                      return (
                        <div key={gameId} className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-xs font-mono">
                          <div>
                            <span className="font-bold text-white uppercase">{gameId}</span>
                            <div className="text-[10px] text-zinc-400 mt-0.5">
                              {stat.starts} Dimulai • {stat.completes} Selesai • {stat.abandons} Keluar
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg font-bold ${compPct >= 70 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {compPct}% Selesai
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-zinc-950 text-center text-xs text-zinc-500">
                    Belum ada data sesi game yang tercatat pada sesi ini.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: RETENTION & ENGAGEMENT */}
          {activeTab === 'retention' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
                  <span className="text-xs font-mono text-zinc-500 uppercase block">Status D1 Retention</span>
                  <div className="flex items-center gap-2 mt-2">
                    {metrics?.retention.d1Active ? (
                      <CheckCircle size={20} className="text-emerald-400" />
                    ) : (
                      <AlertTriangle size={20} className="text-amber-400" />
                    )}
                    <span className="text-sm font-bold text-white">
                      {metrics?.retention.d1Active ? 'Aktif (Hari 2+)' : 'Pemain Hari Pertama'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
                  <span className="text-xs font-mono text-zinc-500 uppercase block">Durasi Sesi Saat Ini</span>
                  <div className="text-xl font-bold font-mono text-cyan-400 mt-2">
                    {Math.floor((metrics?.engagement.currentSessionDurationSec || 0) / 60)}m {(metrics?.engagement.currentSessionDurationSec || 0) % 60}s
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
                  <span className="text-xs font-mono text-zinc-500 uppercase block">Game Dimainkan Sesi Ini</span>
                  <div className="text-xl font-bold font-mono text-indigo-400 mt-2">
                    {metrics?.engagement.gamesThisSession || 0} Ronde
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BALANCING CONFIGURATION */}
          {activeTab === 'balance' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-zinc-400 block uppercase">Versi Balancing Aktif</span>
                  <span className="text-lg font-bold font-mono text-cyan-400">ZiGame Balance {BALANCE_VERSION}</span>
                </div>
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono rounded-lg">
                  Tersentralisasi
                </span>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase">Parameter Multiplier Game</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(GAME_BALANCE_CONFIG).map(([id, cfg]) => (
                    <div key={id} className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-mono flex justify-between items-center">
                      <span className="text-white font-bold uppercase">{id}</span>
                      <span className="text-zinc-400">
                        Coin: {cfg.baseCoinMultiplier}x • XP: {cfg.baseXpMultiplier}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
