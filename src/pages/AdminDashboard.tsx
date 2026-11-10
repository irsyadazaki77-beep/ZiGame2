import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Users, TrendingUp, DollarSign, Settings, CheckCircle2, RefreshCw, AlertTriangle, Trash2, ToggleLeft, ToggleRight, Database, Ban, UserCheck, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '../components/UI';
import { formatNumber } from '../utils/format';
import { isFirebaseReady, auth } from '../services/firebase';
import { useToast } from '../utils/ToastContext';
import { logger } from '../utils/logger';

interface AdminStats {
  dau?: number;
  totalRevenue?: number;
  totalGamesPlayed?: number;
  suspiciousScoresCount: number;
  bannedUsersCount?: number;
  securityEventsCount?: number;
  totalLedgerTransactions?: number;
  activeSessionsCount?: number;
  severityBreakdown?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recentSuspicious?: Array<{
    id: string;
    gameId: string;
    userId: string;
    score: number;
    durationMs: number;
    velocity: number;
    reason: string;
    severity?: string;
    flaggedOnly?: boolean;
    timestamp: string;
  }>;
  activeEvents?: number;
  serverTime: string;
}

interface FlaggedOrBannedUser {
  userId: string;
  strikeCount: number;
  isBanned: boolean;
  banReason?: string;
  bannedAt?: number;
  banExpiresAt?: number | null;
  bannedBy?: string;
  lastViolationAt?: number;
  lastViolationReason?: string;
}

interface SecurityEventItem {
  id: string;
  userId: string;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
  endpoint?: string;
  timestamp: string;
}

interface KillSwitches {
  ranked: boolean;
  economy: boolean;
  seasons: boolean;
}

interface EconomyReconciliationReport {
  userId: string;
  isReconciled: boolean;
  actualBalance: number;
  calculatedBalance: number;
  discrepancy: number;
  transactionCount: number;
}

interface SecurityArchitectureInfo {
  domainRouters: string[];
  schemaGatewayActive: boolean;
  registeredSchemasCount: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [killSwitches, setKillSwitches] = useState<KillSwitches>({ ranked: false, economy: false, seasons: false });
  const [flaggedUsers, setFlaggedUsers] = useState<FlaggedOrBannedUser[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventItem[]>([]);
  const [archInfo, setArchInfo] = useState<SecurityArchitectureInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [reconReport, setReconReport] = useState<EconomyReconciliationReport | null>(null);

  // User Ban Form State
  const [banTargetUid, setBanTargetUid] = useState('');
  const [banReasonInput, setBanReasonInput] = useState('');
  const [banDurationHours, setBanDurationHours] = useState<string>('permanent');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const { showToast } = useToast();

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (isFirebaseReady() && auth?.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        logger.warn('Failed to get token for admin call', { error: e as Error });
      }
    }
    return headers;
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const [resStats, resSwitches, resBans, resArch] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/kill-switches', { headers }),
        fetch('/api/admin/security/bans', { headers }),
        fetch('/api/admin/security/architecture', { headers })
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
      if (resBans.ok) {
        const banData = await resBans.json();
        if (Array.isArray(banData.users)) setFlaggedUsers(banData.users);
        if (Array.isArray(banData.recentEvents)) setSecurityEvents(banData.recentEvents);
      }
      if (resArch.ok) {
        const archData = await resArch.json();
        if (archData.architecture) setArchInfo(archData.architecture);
      }
    } catch (e) {
      logger.error('Failed to load admin stats', { error: e as Error });
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

  const handleBanUser = async () => {
    const cleanUid = banTargetUid.trim();
    if (!cleanUid) {
      showToast('Input Kurang', 'Masukkan User ID yang akan dibekukan.', 'warning');
      return;
    }
    try {
      setActionLoading(true);
      const headers = await getAuthHeaders();
      const durationVal = banDurationHours === 'permanent' ? null : Number(banDurationHours);
      const res = await fetch('/api/admin/security/ban-user', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: cleanUid,
          reason: banReasonInput.trim() || 'Dibekukan oleh Administrator karena pelanggaran keamanan.',
          durationHours: durationVal
        })
      });
      if (res.ok) {
        showToast('Akun Dibekukan', `User '${cleanUid}' berhasil diblokir.`, 'success', '🔒');
        setBanTargetUid('');
        setBanReasonInput('');
        fetchStats();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast('Gagal Blokir', errData.message || 'Gagal membekukan akun pengguna.', 'error');
      }
    } catch (e) {
      showToast('Error', 'Gagal menghubungi server untuk memblokir akun.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnbanUser = async (uid: string) => {
    try {
      setActionLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/security/unban-user', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: uid })
      });
      if (res.ok) {
        showToast('Akun Dipulihkan', `Blokir dan penalti untuk '${uid}' telah dicabut.`, 'success', '✅');
        fetchStats();
      } else {
        showToast('Gagal Pulihkan', 'Gagal membuka blokir akun pengguna.', 'error');
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

  const filteredSuspicious = (stats.recentSuspicious || []).filter(item => {
    if (severityFilter === 'ALL') return true;
    return (item.severity || 'HIGH') === severityFilter;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6"
    >
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <ShieldAlert className="text-fuchsia-500" />
            LIVE OPS & SECURITY CONSOLE
          </h1>
          <p className="text-zinc-400 font-mono text-sm mt-1">Server-authoritative telemetry, HMAC anti-cheat & threat control panel.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Segarkan
        </Button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'ACTIVE SESSIONS', value: formatNumber(stats.activeSessionsCount ?? 0), icon: Users, color: 'text-indigo-400' },
          { label: 'LEDGER TRANSACTIONS', value: formatNumber(stats.totalLedgerTransactions ?? 0), icon: DollarSign, color: 'text-emerald-400' },
          { label: 'BANNED / FROZEN ACCOUNTS', value: formatNumber(stats.bannedUsersCount ?? 0), icon: Ban, color: 'text-rose-400' },
          { label: 'SUSPICIOUS SCORES', value: formatNumber(stats.suspiciousScoresCount), icon: ShieldAlert, color: 'text-amber-400' }
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-[#0f1322] border border-white/[0.06] p-5 rounded-2xl flex flex-col gap-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">{stat.label}</span>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="text-2xl font-black text-white tabular-nums">{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* Threat Monitor & User Suspension Command Panel */}
      <section className="bg-[#0f1322] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
              <Ban className="w-4 h-4 text-rose-400" /> Panel Blokir Pengguna & Pantauan Ancaman Otomatis
            </h2>
            <p className="text-xs font-mono text-zinc-400 mt-0.5">
              Akun yang memicu ≥ 3 pelanggaran HIGH/CRITICAL (manipulasi skor, replay, atau pemalsuan HMAC) dibekukan otomatis.
            </p>
          </div>
          {stats.severityBreakdown && (
            <div className="flex items-center gap-2 flex-wrap shrink-0 font-mono text-[11px] tabular-nums">
              <span className="px-2 py-1 rounded bg-red-950/60 border border-red-800/60 text-red-300 font-bold">
                CRITICAL: {stats.severityBreakdown.critical}
              </span>
              <span className="px-2 py-1 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 font-bold">
                HIGH: {stats.severityBreakdown.high}
              </span>
              <span className="px-2 py-1 rounded bg-blue-950/60 border border-blue-800/60 text-blue-300 font-bold">
                MEDIUM: {stats.severityBreakdown.medium}
              </span>
            </div>
          )}
        </div>

        {/* Manual Ban Control Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase block mb-1">Target User ID</label>
            <input
              type="text"
              placeholder="Contoh: user-123..."
              value={banTargetUid}
              onChange={(e) => setBanTargetUid(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
            />
          </div>
          <div className="md:col-span-4">
            <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase block mb-1">Alasan Pembekuan</label>
            <input
              type="text"
              placeholder="Manipulasi skor / eksploitasi API..."
              value={banReasonInput}
              onChange={(e) => setBanReasonInput(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
            />
          </div>
          <div className="md:col-span-3">
            <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase block mb-1">Durasi Sanksi</label>
            <select
              value={banDurationHours}
              onChange={(e) => setBanDurationHours(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
            >
              <option value="24">24 Jam (Sementara)</option>
              <option value="168">7 Hari (1 Minggu)</option>
              <option value="720">30 Hari (1 Bulan)</option>
              <option value="permanent">Permanen</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Button
              variant="danger"
              size="sm"
              className="w-full justify-center whitespace-nowrap"
              onClick={handleBanUser}
              disabled={actionLoading}
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" /> Bekukan Akun
            </Button>
          </div>
        </div>

        {/* Flagged & Banned Accounts Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-zinc-400 border-b border-white/[0.06]">
              <tr>
                <th className="py-2.5 pr-3">User ID</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Strike</th>
                <th className="py-2.5 px-3">Alasan Terakhir / Blokir</th>
                <th className="py-2.5 px-3">Kedaluwarsa</th>
                <th className="py-2.5 pl-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-zinc-300">
              {flaggedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-500">
                    Belum ada akun yang dibekukan atau memiliki catatan penalti keamanan.
                  </td>
                </tr>
              ) : (
                flaggedUsers.map((u) => (
                  <tr key={u.userId}>
                    <td className="py-2.5 pr-3 font-bold text-white truncate max-w-[160px]">{u.userId}</td>
                    <td className="py-2.5 px-3">
                      {u.isBanned ? (
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold uppercase">
                          DIBEKUKAN
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-bold uppercase">
                          PENGAWASAN
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums font-bold text-amber-300">{u.strikeCount} / 3</td>
                    <td className="py-2.5 px-3 text-zinc-400 max-w-[260px] truncate">
                      {u.banReason || u.lastViolationReason || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 tabular-nums">
                      {u.isBanned
                        ? u.banExpiresAt
                          ? new Date(u.banExpiresAt).toLocaleString()
                          : 'PERMANEN'
                        : '-'}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleUnbanUser(u.userId)}
                        disabled={actionLoading}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-mono font-bold transition cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <UserCheck className="w-3 h-3" /> Pulihkan
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Emergency Kill Switches */}
      <section className="bg-[#0f1322] border border-white/[0.06] rounded-2xl p-6">
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
        <section className="bg-[#0f1322] border border-white/[0.06] rounded-2xl p-6">
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

        <section className="bg-[#0f1322] border border-white/[0.06] rounded-2xl p-6">
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
              <div className={`p-3 rounded-xl font-mono text-xs tabular-nums ${reconReport.isReconciled ? 'bg-emerald-950/40 border border-emerald-500/20 text-emerald-300' : 'bg-red-950/40 border border-red-500/20 text-red-300'} space-y-1`}>
                <div className="font-bold">Status: {reconReport.isReconciled ? 'RECONCILED (Valid)' : 'DISCREPANCY DETECTED'}</div>
                <div>Saldo Aktual: {reconReport.actualBalance} coins</div>
                <div>Saldo Terhitung: {reconReport.calculatedBalance} coins</div>
                <div>Total Transaksi: {reconReport.transactionCount} entries</div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Security Status & Recent Security Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-[#0f1322] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Server Security Status
          </h2>
          <div className="bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl font-mono text-xs text-emerald-300 space-y-1.5">
            <div>Backend Authority: <span className="text-emerald-400 font-bold">ENFORCED</span></div>
            <div>Central Schema Validator Gateway: <span className="text-emerald-400 font-bold tabular-nums">ACTIVE ({archInfo?.registeredSchemasCount ?? 13} SCHEMAS)</span></div>
            <div>Modular Domain Routers: <span className="text-emerald-400 font-bold tabular-nums">{archInfo?.domainRouters?.length ?? 5} ISOLATED MODULES</span></div>
            <div>Session HMAC-SHA256 Signatures: <span className="text-emerald-400 font-bold">ACTIVE (TIMING-SAFE)</span></div>
            <div>Anti-Cheat 3-Strike Auto-Suspension: <span className="text-emerald-400 font-bold">ENFORCED</span></div>
            <div>Payload Sanitizer (XSS / NoSQL / Proto): <span className="text-emerald-400 font-bold">STRICT</span></div>
            <div>Server Timestamp: <span className="text-zinc-400 tabular-nums">{stats.serverTime}</span></div>
          </div>
        </section>

        <section className="bg-[#0f1322] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
            <ShieldCheck className="w-4 h-4 text-indigo-400" /> Log Insiden Keamanan Terbaru ({securityEvents.length})
          </h2>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
            {securityEvents.length === 0 ? (
              <div className="text-zinc-500 py-4 text-center">Belum ada insiden pemblokiran atau serangan injeksi.</div>
            ) : (
              securityEvents.slice(0, 10).map((ev) => (
                <div key={ev.id} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-rose-400 uppercase">{ev.eventType}</span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-300 font-bold truncate">{ev.userId}</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">{ev.reason}</div>
                  </div>
                  <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Suspicious Score Audit Table */}
      <section className="bg-[#0f1322] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide text-amber-400">
            <AlertTriangle className="w-4 h-4" /> Log Skor Mencurigakan (Terbaru)
          </h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-zinc-500 border-b border-white/[0.06]">
              <tr>
                <th className="py-2">Waktu</th>
                <th className="py-2">Game</th>
                <th className="py-2">User ID</th>
                <th className="py-2">Tingkat</th>
                <th className="py-2">Skor</th>
                <th className="py-2">Durasi</th>
                <th className="py-2">Alasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-zinc-300">
              {filteredSuspicious.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zinc-500">
                    Tidak ada catatan anomali skor untuk filter ini.
                  </td>
                </tr>
              ) : (
                filteredSuspicious.map(item => (
                  <tr key={item.id}>
                    <td className="py-2 text-zinc-500 tabular-nums">{new Date(item.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2 text-indigo-300">{item.gameId}</td>
                    <td className="py-2 text-zinc-400 truncate max-w-[120px]">{item.userId}</td>
                    <td className="py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        item.severity === 'CRITICAL' ? 'bg-red-950 text-red-400 border border-red-800' :
                        item.severity === 'HIGH' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        item.severity === 'MEDIUM' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                        'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        {item.severity || 'HIGH'}
                      </span>
                    </td>
                    <td className="py-2 text-amber-300 font-bold tabular-nums">{item.score}</td>
                    <td className="py-2 tabular-nums">{(item.durationMs / 1000).toFixed(1)}s</td>
                    <td className="py-2 text-red-400">
                      {item.reason}
                      {item.flaggedOnly && <span className="text-[10px] text-amber-400 ml-1 font-semibold">[Flag Only]</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </motion.div>
  );
}

