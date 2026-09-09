import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Users, TrendingUp, DollarSign, Settings, CheckCircle2, RefreshCw, AlertTriangle, Trash2, ToggleLeft, ToggleRight, Database } from 'lucide-react';
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

interface KillSwitches {
  ranked: boolean;
  economy: boolean;
  seasons: boolean;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [killSwitches, setKillSwitches] = useState<KillSwitches>({ ranked: false, economy: false, seasons: false });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [reconReport, setReconReport] = useState<any>(null);
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
      const [resStats, resSwitches] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/kill-switches', { headers })
      ]);
      if (resStats.ok) {
        const data = await resStats.json();
        setStats(data);
      }
      if (resSwitches.ok) {
        const swData = await resSwitches.json();
        if (swData.killSwitches) {
          setKillSwitches(swData.killSwitches);
        }
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

  const handleToggleKillSwitch = async (feature: keyof KillSwitches) => {
    try {
      setActionLoading(true);
      const headers = await getAuthHeaders();
      const newState = !killSwitches[feature];
      const res = await fetch('/api/admin/kill-switches', {
        method: 'POST',
        headers,
        body: JSON.stringify({ feature, active: newState })
      });
      if (res.ok) {
        setKillSwitches(prev => ({ ...prev, [feature]: newState }));
        showToast('Kill Switch Diperbarui', `Fitur '${feature}' sekarang: ${newState ? 'DIMATIKAN (Maintenance)' : 'AKTIF'}`, 'success', '🛡️');
      } else {
        showToast('Gagal Toggle', 'Server menolak pembaruan kill switch.', 'error');
      }
    } catch (e) {
      showToast('Error', 'Gagal menghubungi server.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReconcileUser = async () => {
    if (!targetUserId.trim()) {
      showToast('Input Kurang', 'Masukkan User ID yang valid.', 'warning');
      return;
    }
    try {
      setActionLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/reconcile-economy', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: targetUserId.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setReconReport(data.report);
        showToast('Audit Selesai', `Status rekonsiliasi: ${data.report.isReconciled ? 'COCOK (Lolos Audit)' : 'DISCREPANCY (Anomali)'}`, data.report.isReconciled ? 'success' : 'warning', '📊');
      } else {
        showToast('Gagal Rekonsiliasi', 'Gagal memproses data audit user.', 'error');
      }
    } catch (e) {
      showToast('Error', 'Gagal memproses audit ekonomi.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

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

      {/* Emergency Kill Switches */}
      <section className="bg-[#0f1322] border border-white/[0.04] rounded-2xl p-6">
        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide text-red-400">
          <ShieldAlert className="w-4 h-4" /> Emergency Incident Kill Switches
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(['ranked', 'economy', 'seasons'] as const).map((feat) => {
            const isBlocked = killSwitches[feat];
            return (
              <div key={feat} className="bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">{feat}</div>
                  <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                    {isBlocked ? <span className="text-red-400 font-bold">DIMATIKAN</span> : <span className="text-emerald-400 font-bold">ONLINE</span>}
                  </div>
                </div>
                <Button 
                  variant={isBlocked ? "danger" : "outline"} 
                  size="sm" 
                  onClick={() => handleToggleKillSwitch(feat)} 
                  disabled={actionLoading}
                >
                  {isBlocked ? <ToggleRight className="w-4 h-4 mr-1 text-red-300" /> : <ToggleLeft className="w-4 h-4 mr-1 text-zinc-400" />}
                  {isBlocked ? 'Matikan Kill Switch' : 'Aktifkan'}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Server Controls & Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <Database className="w-4 h-4 text-indigo-400" /> User Ledger Reconciliation Audit
          </h2>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Masukkan User ID..." 
                value={targetUserId} 
                onChange={(e) => setTargetUserId(e.target.value)}
                className="flex-1 bg-black/40 border border-white/[0.06] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <Button size="sm" variant="primary" onClick={handleReconcileUser} disabled={actionLoading}>
                Audit User
              </Button>
            </div>
            {reconReport && (
              <div className={`p-3 rounded-xl font-mono text-xs ${reconReport.isReconciled ? 'bg-emerald-950/40 border border-emerald-500/20 text-emerald-300' : 'bg-red-950/40 border border-red-500/20 text-red-300'} space-y-1`}>
                <div className="font-bold">Status: {reconReport.isReconciled ? 'RECONCILED (Valid)' : 'DISCREPANCY DETECTED'}</div>
                <div>Saldo Aktual: {reconReport.actualBalance} coins</div>
                <div>Saldo Terhitung: {reconReport.calculatedBalance} coins</div>
                <div>Total Transaksi: {reconReport.transactionCount} entries</div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
