import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, Bookmark, Share2, Info, Clock, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { translations } from '../../translations';
import { cn, formatLocaleDate, formatShortMonthDayYear } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { Button, GlassCard } from '../ui/Button';
import type { Market } from '../../types/market';
import { getOutcomeTokenId, isMultiOutcome, isPolymarket } from '../../lib/marketUtils';

export function MarketDetail({ market: initialMarket, onClose, onBet, onSave, onShare, showToast }: { market: Market; onClose: () => void; onBet: (m: Market, s: 'YES' | 'NO') => void; onSave: () => void; onShare: () => void; showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const { user, isLoggedIn, language } = useAuthStore();
  const t = translations[language];
  const [market, setMarket] = useState<any>(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!initialMarket?.id) return;
      try {
        const url = `/api/markets/${initialMarket.id}`;
        const res = await apiFetch(url);
        const data = await res.json();
        if (data && !data.error) {
          setMarket((prev: any) => {
            if (!prev) return data;
            // Merge fetched data with current state to preserve any optimistic updates
            return { ...prev, ...data, comments: data.comments || prev?.comments || [] };
          });
        } else {
          onClose();
        }
      } catch (e) {
        onClose();
      }
    };
    
    // Optimistically update from props if they change (e.g. after a bet)
    if (initialMarket) {
      setMarket((prev: any) => {
        if (!prev) return initialMarket;
        return { ...prev, ...initialMarket };
      });
    }
    
    fetchDetail();
  }, [initialMarket.id, initialMarket.yesPercent, initialMarket.noPercent, user?.id]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn || !commentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/markets/${market.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || (data.error && data.error.includes("User not found"))) {
          useAuthStore.getState().logout();
          window.location.reload();
          return;
        }
        throw new Error(data.error || 'Failed to post comment');
      }

      const newComment = data;
      setMarket((prev: any) => ({
        ...prev,
        comments: [newComment, ...(prev.comments || [])],
        _count: {
          ...prev._count,
          comments: (prev._count?.comments ?? 0) + 1,
        },
      }));
      setCommentText('');
    } catch (e) {
      console.error(e);
      showToast(e instanceof Error ? e.message : 'Failed to post comment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!market) return (
    <div className="w-full h-full bg-zinc-950 flex items-center justify-center rounded-3xl">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const chartData =
    market.priceHistory && market.priceHistory.length > 0
      ? market.priceHistory.map((p: any) => ({
          time: formatLocaleDate(p.createdAt, language, { day: 'numeric', month: 'short' }),
          value: p.value,
        }))
      : Array.from({ length: 6 }, (_, i) => ({
          time: formatLocaleDate(
            new Date(Date.now() - (5 - i) * 30 * 24 * 60 * 60 * 1000),
            language,
            { month: 'short' }
          ),
          value: 45 + i * 3,
        }));

  return (
    <motion.div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="market-detail-title"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="bg-zinc-950 w-full h-full max-h-[90vh] lg:max-w-md lg:h-full lg:max-h-full flex flex-col rounded-t-3xl lg:rounded-none overflow-hidden shadow-2xl relative z-[110]"
      onClick={e => e.stopPropagation()}
    >
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-full"><ArrowLeft size={24} /></button>
        <span id="market-detail-title" className="font-bold text-sm uppercase tracking-widest truncate max-w-[200px]">{market.title}</span>
        <div className="flex items-center gap-1">
          <button 
            onClick={onSave} 
            className={cn("p-2 rounded-full transition-colors", market.userSaved ? "text-emerald-500" : "text-zinc-400 hover:bg-zinc-900")}
          >
            <Bookmark size={20} fill={market.userSaved ? "currentColor" : "none"} />
          </button>
          <button onClick={onShare} className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400"><Share2 size={20} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-12 no-scrollbar">
        {/* Chart Section - Now inside scrollable area */}
        <div className="bg-zinc-950 border-b border-white/5">
          <div className="w-full h-64 bg-zinc-900/30 relative overflow-hidden touch-pan-y">
            <div className="absolute inset-0 z-10 w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} strokeOpacity={0.1} />
                  <XAxis 
                    dataKey="time" 
                    hide 
                    padding={{ left: 0, right: 0 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    allowDecimals={false}
                    tickFormatter={(v: number) => `${Math.round(v)}%`}
                    tick={{ fill: '#71717a', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                    itemStyle={{ color: '#10b981' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="px-6 py-4 flex gap-2 flex-wrap">
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
              {market.category}
            </span>
            <span className={cn(
              "text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider flex items-center gap-1",
              new Date(market.expiresAt) < new Date()
                ? "bg-rose-500/20 text-rose-400"
                : "bg-zinc-800 text-zinc-400"
            )}>
              <Clock size={10} />
              {new Date(market.expiresAt) < new Date()
                ? t.expired
                : formatShortMonthDayYear(market.expiresAt, language)
              }
            </span>
          </div>
        </div>

        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6 leading-tight">{market.title}</h1>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <GlassCard className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">All-time High</span>
            <span className="text-lg font-bold">{Math.max(market.yesPercent, market.noPercent, 75).toFixed(0)}%</span>
          </GlassCard>
          <GlassCard className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Volatility</span>
            <span className={cn("text-lg font-bold", market.totalPool > 1000000 ? "text-rose-500" : "text-emerald-500")}>
              {market.totalPool > 1000000 ? "High" : "Stable"}
            </span>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
              <Info size={14} /> {t.description}
            </h3>
            <p className="text-zinc-400 leading-relaxed text-sm">
              {market.description}
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
              <MessageCircle size={14} /> {t.comments} ({market._count.comments})
            </h3>
            
            {isLoggedIn && (
              <form onSubmit={handlePostComment} className="mb-6 flex gap-2">
                <input 
                  type="text" 
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
                <Button type="submit" disabled={!commentText.trim() || isSubmitting} className="py-2 px-4">
                  Post
                </Button>
              </form>
            )}

            <div className="space-y-4">
              {market.comments?.map((c: any, i: number) => (
                <div key={`comment-${c.id || i}-${i}`} className="flex gap-3">
                  <img src={c.user.avatar} className="w-8 h-8 rounded-full bg-zinc-800" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold">@{c.user.handle}</span>
                      <span className="text-[10px] text-zinc-600">{formatLocaleDate(c.createdAt, language)}</span>
                    </div>
                    <p className="text-xs text-zinc-400">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>

    <div className="p-6 border-t border-white/5 bg-zinc-950">
      {isMultiOutcome(market) ? (
        <div className="grid grid-cols-2 gap-2">
          {market.outcomes!.map((outcome, i) => {
            const pct = ((market.outcomePrices?.[i] ?? 0) * 100).toFixed(0);
            return (
              <Button
                key={outcome}
                variant="secondary"
                className="py-3 rounded-2xl font-bold text-sm"
                onClick={() => onBet(market, outcome)}
              >
                {outcome} <span className="text-emerald-400 ml-1">{pct}%</span>
              </Button>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-4">
          <Button
            variant="primary"
            className="flex-1 py-4 rounded-2xl font-bold text-black"
            onClick={() => onBet(market, 'YES')}
          >
            YES {market.yesPercent.toFixed(0)}%
          </Button>
          <Button
            variant="danger"
            className="flex-1 py-4 rounded-2xl font-bold"
            onClick={() => onBet(market, 'NO')}
          >
            NO {market.noPercent.toFixed(0)}%
          </Button>
        </div>
      )}
      </div>
    </motion.div>
  );
}
