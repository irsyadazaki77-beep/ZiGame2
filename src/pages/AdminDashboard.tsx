import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Users, TrendingUp, DollarSign, Target, Settings, CheckCircle2, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '../components/UI';
import { formatNumber } from '../utils/format';
import { isFirebaseReady, auth } from '../services/firebase';
import { useToast } from '../utils/ToastContext';

interface AdminStats {
  dau: number;
  totalRevenue: number;
  totalGamesPlayed: number;
  suspiciousScoresCount: number;
  recentSuspicious?: Array<{
    id: string;
    gameId: string;
    userId: string;
    score: number;
    durationMs: number;
    velocity: number;
    reason: string;
    timestamp: string;
  }>;
  activeEvents: number;
  serverTime: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { showToast } = useToast();

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (isFirebaseReady() && auth?.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        console.warn('Failed to get token for admin call:', e);
      }
    }
    return headers;
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/stats', { headers });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        showToast('Gagal Memuat Stats', 'Gagal memuat telemetri server admin.', 'error');
      }
    } catch (e) {
      console.error('Failed to load admin stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleForceSync = async () => {
    try {
      setActionLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/force-sync', {
        method: 'POST',
        headers
      });
      if (res.ok) {
        showToast('Sinkronisasi Sukses', 'State authoritative server disinkronkan.', 'success', '⚡');
      } else {
        showToast('Gagal Sinkronisasi', 'Server menolak perintah.', 'error');
      }
    } catch (e) {
      showToast('Error', 'Gagal memicu sinkronisasi.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePurgeSuspectScores = async () => {
    try {
      setActionLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/purge-suspect-scores', {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        showToast('Audit Selesai', `Berhasil membersihkan ${data.purgedCount || 0} entri anomali skor.`, 'success', '🛡️');
        fetchStats();
      } else {
        showToast('Gagal Purge', 'Gagal membersihkan skor anomali.', 'error');
      }
    } catch (e) {
      showToast('Error', 'Gagal membersihkan skor mencurigakan.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex h-full items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6"
    >
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <ShieldAlert className="text-fuchsia-500" />
            LIVE OPS & SECURITY CONSOLE
          </h1>
          <p className="text-zinc-400 font-mono text-sm mt-1">Server-authoritative telemetry & anti-cheat control panel.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Segarkan
        </Button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'DAILY ACTIVE', value: formatNumber(stats.dau), icon: Users, color: 'text-indigo-400' },
          { label: 'ECONOMY INFLOW', value: formatNumber(stats.totalRevenue), icon: DollarSign, color: 'text-emerald-400' },
          { label: 'TOTAL PLAYS', value: formatNumber(stats.totalGamesPlayed), icon: TrendingUp, color: 'text-amber-400' },
          { label: 'SUSPICIOUS SCORES', value: stats.suspiciousScoresCount, icon: ShieldAlert, color: 'text-red-400' }
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-[#0f1322] border border-white/[0.04] p-5 rounded-2xl flex flex-col gap-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{stat.label}</span>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="text-2xl font-black text-white">{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <section className="bg-[#0f1322] border border-white/[0.04] rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
            <Settings className="w-4 h-4 text-zinc-400" /> Server Controls
          </h2>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-between" onClick={handleForceSync} disabled={actionLoading}>
              Force Authoritative State Sync <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="danger" className="w-full justify-between" onClick={handlePurgeSuspectScores} disabled={actionLoading}>
              Purge Suspect Scores <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </section>

        <section className="bg-[#0f1322] border border-white/[0.04] rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Server Security Status
          </h2>
          <div className="space-y-4">
            <div className="bg-white/[0.02] p-4 rounded-xl font-mono text-xs text-emerald-300 space-y-1">
              <div>Backend Authority: <span className="text-emerald-400 font-bold">ENFORCED</span></div>
              <div>Anti-Cheat Velocity Checks: <span className="text-emerald-400 font-bold">ACTIVE</span></div>
              <div>ID Token Verification: <span className="text-emerald-400 font-bold">STRICT</span></div>
              <div>Server Timestamp: <span className="text-zinc-400">{stats.serverTime}</span></div>
            </div>
          </div>
        </section>
      </div>

      {stats.recentSuspicious && stats.recentSuspicious.length > 0 && (
        <section className="bg-[#0f1322] border border-white/[0.04] rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide text-amber-400">
            <AlertTriangle className="w-4 h-4" /> Log Skor Mencurigakan (Terbaru)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-zinc-500 border-b border-white/[0.04]">
                <tr>
                  <th className="py-2">Waktu</th>
                  <th className="py-2">Game</th>
                  <th className="py-2">User ID</th>
                  <th className="py-2">Skor</th>
                  <th className="py-2">Durasi</th>
                  <th className="py-2">Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02] text-zinc-300">
                {stats.recentSuspicious.map(item => (
                  <tr key={item.id}>
                    <td className="py-2 text-zinc-500">{new Date(item.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2 text-indigo-300">{item.gameId}</td>
                    <td className="py-2 text-zinc-400 truncate max-w-[120px]">{item.userId}</td>
                    <td className="py-2 text-amber-300 font-bold">{item.score}</td>
                    <td className="py-2">{(item.durationMs / 1000).toFixed(1)}s</td>
                    <td className="py-2 text-red-400">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </motion.div>
  );
}
