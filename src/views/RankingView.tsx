import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { translations } from '../translations';
import { cn, formatPrice } from '../lib/utils';
import { apiFetch } from '../lib/api';
import { GlassCard } from '../components/ui/Button';

export function RankingView() {
  const { language } = useAuthStore();
  const t = translations[language];
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/users/rankings')
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setRankings([]);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data)) {
          setRankings(data);
        } else {
          setRankings([]);
        }
      })
      .catch(() => {
        if (!cancelled) setRankings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full pt-6 pb-24 overflow-y-auto no-scrollbar px-6"
    >
      <h2 className="text-3xl font-black mb-6 tracking-tighter">{t.leaderboard}</h2>
      
      {loading ? (
        <div key="ranking-loading" className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : rankings.length === 0 ? (
        <p className="text-zinc-500 text-sm py-8 text-center">{t.leaderboardEmpty}</p>
      ) : (
        <div key="ranking-list" className="space-y-3">
          {rankings.map((u, i) => (
            <GlassCard key={`rank-${u.id || i}-${i}`} className="flex items-center gap-4 py-3">
              <span className={cn(
                "w-6 text-center font-black italic text-lg",
                i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-400" : i === 2 ? "text-amber-600" : "text-zinc-600"
              )}>
                {i + 1}
              </span>
              <img src={u.avatar} alt="" className="w-10 h-10 rounded-xl bg-zinc-800" />
              <div className="flex-1">
                <div className="font-bold">@{u.handle}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest">{u._count?.bets ?? 0} {t.bets}</div>
              </div>
              <div className="text-right">
                <div className="font-black text-emerald-400">{formatPrice(u.totalWinnings || 0, language)}</div>
                <div className="text-[10px] text-zinc-600 uppercase tracking-widest">{t.totalWon}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </motion.div>
  );
}
