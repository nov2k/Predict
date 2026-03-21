import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Heart, ArrowUpRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { translations } from '../translations';
import { apiFetch } from '../lib/api';
import { GlassCard } from '../components/ui/Button';
import type { Market } from '../types/market';

export function SavedView({ userId, onBack, onMarketClick }: { userId: string | undefined; onBack: () => void; onMarketClick: (m: Market) => void }) {
  const { language } = useAuthStore();
  const t = translations[language];
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setMarkets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch(`/api/users/${userId}/saves`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMarkets(data);
        } else {
          setMarkets([]);
        }
        setLoading(false);
      })
      .catch(() => {
        setMarkets([]);
        setLoading(false);
      });
  }, [userId]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full pt-6 pb-24 overflow-y-auto no-scrollbar px-6"
    >
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-zinc-900 rounded-full"><ArrowLeft size={24} /></button>
        <h2 className="text-3xl font-black tracking-tighter">{t.saved}</h2>
      </div>
      
      {loading ? (
        <div key="saved-loading" className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : markets.length === 0 ? (
        <div key="no-saved" className="text-center py-12 text-zinc-500">{t.savedEmpty}</div>
      ) : (
        <div key="saved-list" className="space-y-4">
          {markets?.map((m, i) => (
            <GlassCard key={`saved-market-${m.id || i}-${i}`} className="flex gap-4 items-center" onClick={() => onMarketClick(m)}>
              <img src={m.imageUrl} className="w-16 h-16 rounded-xl object-cover" />
              <div className="flex-1">
                <h4 className="font-bold text-sm leading-tight mb-1">{m.title}</h4>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">{m.category}</span>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold">
                    <Heart size={10} className="text-rose-500" fill="currentColor" /> {m._count.likes}
                  </div>
                </div>
              </div>
              <ArrowUpRight size={20} className="text-zinc-600" />
            </GlassCard>
          ))}
        </div>
      )}
    </motion.div>
  );
}
