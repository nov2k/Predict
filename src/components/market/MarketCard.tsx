import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Wallet, User as UserIcon, Clock, Heart, MessageCircle, Bookmark, Share2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { translations } from '../../translations';
import { cn, formatPrice, formatShortMonthDay } from '../../lib/utils';
import { GlassCard } from '../ui/Button';
import type { Market } from '../../types/market';
import { isMultiOutcome } from '../../lib/marketUtils';

export function MarketCard({ market, direction, onDetail, onSwipe, onLike, onSave, onShare, isFirst, isLast }: { 
  market: Market; 
  direction: 'up' | 'down' | null;
  onDetail: () => void;
  onSwipe: (d: 'up' | 'down') => void;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const touchStart = useRef(0);
  const { user, isLoggedIn, language } = useAuthStore();
  const t = translations[language];

  const variants = {
    initial: (direction: string | null) => ({
      y: direction === 'up' ? '100%' : direction === 'down' ? '-100%' : 0,
      opacity: direction ? 0 : 1,
      scale: direction ? 0.9 : 1
    }),
    animate: {
      y: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: string | null) => ({
      y: direction === 'up' ? '-100%' : direction === 'down' ? '100%' : 0,
      opacity: 0,
      scale: 0.9
    }),
    bounceUp: {
      y: [0, -30, 0],
      transition: { duration: 0.4 }
    },
    bounceDown: {
      y: [0, 30, 0],
      transition: { duration: 0.4 }
    }
  };

  const isAtLimit = (direction === 'up' && isLast) || (direction === 'down' && isFirst);

  return (
    <motion.div 
      custom={direction}
      variants={variants}
      initial="initial"
      animate={isAtLimit ? (direction === 'up' ? "bounceUp" : "bounceDown") : "animate"}
      exit="exit"
      transition={{ type: 'spring', damping: 30, stiffness: 200 }}
      className="absolute inset-0 w-full h-full bg-black"
      onWheel={e => {
        if (Math.abs(e.deltaY) > 30) {
          onSwipe(e.deltaY > 0 ? 'up' : 'down');
        }
      }}
      onTouchStart={e => touchStart.current = e.touches[0].clientY}
      onTouchEnd={e => {
        const delta = touchStart.current - e.changedTouches[0].clientY;
        if (Math.abs(delta) > 50) {
          onSwipe(delta > 0 ? 'up' : 'down');
        }
      }}
    >
      {/* Background Media */}
      <div className="absolute inset-0 bg-zinc-950">
        {market.videoUrl ? (
          <video 
            src={market.videoUrl} 
            className="w-full h-full object-cover opacity-60" 
            autoPlay 
            loop 
            muted 
            playsInline 
          />
        ) : (
          <img 
            src={market.imageUrl} 
            className="w-full h-full object-cover opacity-40" 
            alt=""
            referrerPolicy="no-referrer"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-zinc-900/40 to-black/60" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end p-4 pr-18 pb-28 lg:pb-12 sm:pr-6">
        <div className="flex flex-col gap-2 max-w-lg">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-emerald-500/30">
              {market.category}
            </span>
            <span className="bg-zinc-800/80 text-zinc-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-white/5 flex items-center gap-1">
              <TrendingUp size={10} />
              {t.trending}
            </span>
            <span className={cn(
              "text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider border flex items-center gap-1",
              new Date(market.expiresAt) < new Date()
                ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                : "bg-zinc-800/80 text-zinc-400 border-white/5"
            )}>
              <Clock size={10} />
              {new Date(market.expiresAt) < new Date()
                ? t.expired
                : formatShortMonthDay(market.expiresAt, language)
              }
            </span>
          </div>

          <h1 className="text-2xl font-bold leading-tight tracking-tight" onClick={onDetail}>
            {market.title}
          </h1>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <GlassCard className="flex items-center gap-2 p-2 px-3">
              <Wallet size={14} className="text-zinc-500" />
              <span className="text-sm font-bold">{formatPrice(market.totalPool, language)}</span>
            </GlassCard>
            <GlassCard className="flex items-center gap-2 p-2 px-3">
              <UserIcon size={14} className="text-zinc-500" />
              <span className="text-sm font-bold">{market.bettorsCount >= 1000 ? `${(market.bettorsCount / 1000).toFixed(1)}K` : market.bettorsCount}</span>
            </GlassCard>
          </div>

          {isMultiOutcome(market) ? (
            <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar" onClick={(e) => e.stopPropagation()}>
              {market.outcomes!.map((outcome, i) => (
                <button
                  key={outcome}
                  onClick={(e) => { e.stopPropagation(); onDetail(); }}
                  className="shrink-0 bg-zinc-800/80 hover:bg-zinc-700 border border-white/10 px-3 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95"
                >
                  <span className="text-xs font-bold text-white">{outcome}</span>
                  <span className="text-emerald-400 text-sm font-black">
                    {((market.outcomePrices?.[i] ?? 0) * 100).toFixed(0)}%
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); onDetail(); }}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black py-2 rounded-xl flex items-center justify-center transition-all active:scale-95"
              >
                <span className="text-base">YES {market.yesPercent.toFixed(0)}%</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDetail(); }}
                className="flex-1 bg-rose-500 hover:bg-rose-400 text-white font-black py-2 rounded-xl flex items-center justify-center transition-all active:scale-95"
              >
                <span className="text-base">NO {market.noPercent.toFixed(0)}%</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Rail */}
      <div className="absolute right-4 bottom-28 flex flex-col gap-4 items-center">
        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            className={cn(
              "w-11 h-11 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-90 transition-all",
              market.userLiked ? "bg-rose-500 text-white border-rose-500" : "bg-zinc-900/60 text-white"
            )}
          >
            <Heart size={22} fill={market.userLiked ? "currentColor" : "none"} />
          </button>
          <span className="text-[10px] font-bold">{market._count.likes}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button onClick={onDetail} className="w-11 h-11 rounded-full bg-zinc-900/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform">
            <MessageCircle size={22} />
          </button>
          <span className="text-[10px] font-bold">{market._count.comments}</span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          className={cn(
            "w-11 h-11 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-90 transition-all",
            market.userSaved ? "bg-emerald-500 text-black border-emerald-500" : "bg-zinc-900/60 text-white"
          )}
        >
          <Bookmark size={22} fill={market.userSaved ? "currentColor" : "none"} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onShare(); }}
          className="w-11 h-11 rounded-full bg-zinc-900/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          <Share2 size={22} />
        </button>
      </div>
    </motion.div>
  );
}
