import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { translations } from '../translations';
import { cn, formatLocaleDate, formatPrice } from '../lib/utils';
import { apiFetch } from '../lib/api';
import { GlassCard } from '../components/ui/Button';

export function HistoryView({ userId }: { userId?: string }) {
  const { language } = useAuthStore();
  const t = translations[language];
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setBets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch(`/api/users/${userId}/bets`)
      .then(async (res) => {
        if (!res.ok) {
          setBets([]);
          return;
        }
        const data = await res.json();
        setBets(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setBets([]);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const statusColor = (s: string) => {
    if (s === 'won') return 'bg-emerald-500/20 text-emerald-400';
    if (s === 'lost') return 'bg-rose-500/20 text-rose-400';
    return 'bg-amber-500/20 text-amber-400';
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full w-full pt-6 pb-24 overflow-y-auto no-scrollbar px-6">
      <h2 className="text-3xl font-black mb-6 tracking-tighter">{t.myBets}</h2>
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : bets.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">{t.noBets}</div>
      ) : (
        <div className="space-y-4">
          {bets.map((b, i) => (
            <GlassCard key={`bet-${b.id || i}`} className="flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest", b.side === 'YES' ? "bg-emerald-500/20 text-emerald-400" : b.side === 'NO' ? "bg-rose-500/20 text-rose-400" : "bg-zinc-700 text-zinc-300")}>
                    {b.side}
                  </span>
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest", statusColor(b.status || 'pending'))}>
                    {b.status || 'pending'}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-600">{formatLocaleDate(b.createdAt, language)}</span>
              </div>
              <h4 className="font-bold text-sm leading-tight">{b.market?.title || b.externalMarketId || t.polymarketBetTitle}</h4>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <div>
                  <span className="text-xs text-zinc-500">{t.betRowBet} </span>
                  <span className="font-bold text-sm">{formatPrice(b.amount, language)}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">{t.betRowOdds} </span>
                  <span className="font-bold text-sm text-amber-400">{(b.odds || 1).toFixed(2)}x</span>
                </div>
                {b.status === 'won' && b.payout > 0 && (
                  <div>
                    <span className="text-xs text-zinc-500">{t.betRowWon} </span>
                    <span className="font-bold text-sm text-emerald-400">+{formatPrice(b.payout, language)}</span>
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </motion.div>
  );
}
