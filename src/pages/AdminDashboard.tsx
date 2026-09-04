import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Users, TrendingUp, DollarSign, Target, Settings, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '../components/UI';
import { formatNumber } from '../utils/format';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated fetch for live ops dashboard
    setTimeout(() => {
      setStats({
        dau: 1205,
        totalRevenue: 54200,
        totalGamesPlayed: 8540,
        suspiciousScores: 3,
        activeEvents: 1,
      });
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
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
            LIVE OPS DASHBOARD
          </h1>
          <p className="text-zinc-400 font-mono text-sm mt-1">Classified telemetry access.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'DAILY ACTIVE', value: formatNumber(stats.dau), icon: Users, color: 'text-indigo-400' },
          { label: 'ECONOMY INFLOW', value: formatNumber(stats.totalRevenue), icon: DollarSign, color: 'text-emerald-400' },
          { label: 'TOTAL PLAYS', value: formatNumber(stats.totalGamesPlayed), icon: TrendingUp, color: 'text-amber-400' },
          { label: 'SUSPICIOUS', value: stats.suspiciousScores, icon: ShieldAlert, color: 'text-red-400' }
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-[#0f1322] border border-white/[0.04] p-5 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">{stat.label}</span>
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
            <Button variant="outline" className="w-full justify-between">
              Force Economy Sync <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="w-full justify-between text-amber-400 border-amber-500/20">
              Trigger Dynamic Event <Target className="w-4 h-4" />
            </Button>
            <Button variant="danger" className="w-full justify-between">
              Purge Suspect Scores <ShieldAlert className="w-4 h-4" />
            </Button>
          </div>
        </section>

        <section className="bg-[#0f1322] border border-white/[0.04] rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Active Season Config
          </h2>
          <div className="space-y-4">
            <div className="bg-white/[0.02] p-4 rounded-xl font-mono text-[10px] text-emerald-300">
              <pre>{JSON.stringify({ season: "S3", name: "Cyber Genesis", endAt: "2026-12-31" }, null, 2)}</pre>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
