import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Wallet, User as UserIcon, Clock, Heart, MessageCircle, Bookmark, Share2, Play, Pause, Volume2, VolumeX } from 'lucide-react';
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { user, isLoggedIn, language } = useAuthStore();
  const t = translations[language];
  const [isPaused, setIsPaused] = useState(false);
  const [showUnmuteHint, setShowUnmuteHint] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

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
  const yesPct = Math.round(Number(market.yesPercent) || 0);
  const noPct = Math.max(0, 100 - yesPct);

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (v.paused) {
        await v.play();
        setIsPaused(false);
      } else {
        v.pause();
        setIsPaused(true);
      }
    } catch (e) {
      // iOS/Safari may block play with sound without direct user gesture.
      console.error('Video play toggle failed:', e);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const nextMuted = !v.muted;
    v.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) setShowUnmuteHint(false);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !market.videoUrl) return;

    // TikTok-like behavior: each opened/swiped card starts playing automatically.
    v.currentTime = 0;
    v.muted = false;
    setIsMuted(false);
    setIsPaused(false);
    void v.play().catch(() => {
      // Autoplay with sound is often blocked. Fallback to muted autoplay.
      v.muted = true;
      setIsMuted(true);
      setShowUnmuteHint(true);
      void v.play().catch(() => {
        setIsPaused(true);
      });
    });
  }, [market.id, market.videoUrl]);

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
            ref={videoRef}
            src={market.videoUrl} 
            className="w-full h-full object-cover" 
            autoPlay 
            loop 
            muted={isMuted}
            playsInline 
            onPlay={() => setIsPaused(false)}
            onPause={() => setIsPaused(true)}
            onVolumeChange={(e) => setIsMuted((e.currentTarget as HTMLVideoElement).muted)}
            onClick={(e) => {
              e.stopPropagation();
              const v = videoRef.current;
              if (!v) return;
              // First tap on muted video should enable sound (mobile-friendly behavior).
              if (v.muted) {
                v.muted = false;
                setIsMuted(false);
                setShowUnmuteHint(false);
                void v.play().catch(() => {});
                return;
              }
              void togglePlay();
            }}
          />
        ) : (
          <img 
            src={market.imageUrl} 
            className="w-full h-full object-cover opacity-40" 
            alt=""
            referrerPolicy="no-referrer"
          />
        )}
        <div
          className={cn(
            "absolute inset-0 pointer-events-none",
            market.videoUrl
              ? "bg-gradient-to-t from-black/35 via-black/10 to-black/35"
              : "bg-gradient-to-t from-black via-zinc-900/40 to-black/60"
          )}
        />
        {market.videoUrl ? (
          <div className="absolute left-4 top-24 lg:top-4 z-20 flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void togglePlay();
              }}
              className="touch-video-overlay-btn w-12 h-12 rounded-full bg-black/55 backdrop-blur-md border border-white/20 text-white flex items-center justify-center active:scale-95 transition-transform"
              aria-label={isPaused ? "Play video" : "Pause video"}
              title={isPaused ? "Play video" : "Pause video"}
            >
              {isPaused ? <Play size={22} /> : <Pause size={22} />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className="touch-video-overlay-btn w-12 h-12 rounded-full bg-black/55 backdrop-blur-md border border-white/20 text-white flex items-center justify-center active:scale-95 transition-transform"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
              title={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </button>
          </div>
        ) : null}
        {market.videoUrl && (showUnmuteHint || isMuted) ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const v = videoRef.current;
              if (!v) return;
              v.muted = false;
              setIsMuted(false);
              setShowUnmuteHint(false);
              void v.play().catch(() => {});
            }}
            className="absolute left-1/2 -translate-x-1/2 bottom-44 z-20 px-4 py-2 rounded-full bg-black/65 border border-white/25 text-white text-sm font-semibold backdrop-blur-md"
            aria-label="Tap to unmute"
          >
            Tap to unmute
          </button>
        ) : null}
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end p-4 pr-20 pb-[7.8rem] lg:pb-12 sm:pr-6">
        <div className="flex flex-col gap-3 max-w-lg">
          <div className="inline-flex max-w-[calc(100vw-8rem)] sm:max-w-[calc(100%-5rem)] w-fit items-center gap-1.5 bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl px-2 py-1 overflow-hidden">
            <span className="shrink-0 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border border-emerald-500/30">
              {market.category}
            </span>
            <span className="shrink-0 bg-zinc-800/80 text-zinc-200 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border border-white/10 flex items-center gap-1">
              <TrendingUp size={10} />
              {t.trending}
            </span>
            <span className={cn(
              "min-w-0 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border flex items-center gap-1",
              new Date(market.expiresAt) < new Date()
                ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                : "bg-zinc-800/80 text-zinc-300 border-white/10"
            )}>
              <Clock size={10} className="shrink-0" />
              <span className="truncate">
                {new Date(market.expiresAt) < new Date()
                  ? t.expired
                  : formatShortMonthDay(market.expiresAt, language)
                }
              </span>
            </span>
          </div>

          <h1 className="touch-market-title text-2xl font-bold leading-tight tracking-tight" onClick={onDetail}>
            {market.title}
          </h1>

          <div className="inline-flex max-w-[calc(100vw-8rem)] sm:max-w-[calc(100%-5rem)] w-fit items-center gap-2 bg-black/45 backdrop-blur-sm border border-white/10 rounded-2xl px-2 py-1.5 overflow-hidden">
            <GlassCard className="min-w-0 flex items-center gap-2 p-2 px-2.5 bg-transparent border-0">
              <Wallet size={14} className="text-zinc-500" />
              <span className="min-w-0 truncate tabular-nums text-sm font-bold">{formatPrice(market.totalPool, language)}</span>
            </GlassCard>
            <div className="h-6 w-px bg-white/10" />
            <GlassCard className="shrink-0 flex items-center gap-2 p-2 px-2.5 bg-transparent border-0">
              <UserIcon size={14} className="text-zinc-500" />
              <span className="tabular-nums text-sm font-bold">{market.bettorsCount >= 1000 ? `${(market.bettorsCount / 1000).toFixed(1)}K` : market.bettorsCount}</span>
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
                className="touch-bet-btn flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black py-2 rounded-xl flex items-center justify-center transition-all active:scale-95"
              >
                <span className="touch-bet-label text-base">YES {yesPct}%</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDetail(); }}
                className="touch-bet-btn flex-1 bg-rose-500 hover:bg-rose-400 text-white font-black py-2 rounded-xl flex items-center justify-center transition-all active:scale-95"
              >
                <span className="touch-bet-label text-base">NO {noPct}%</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Rail */}
      <div className="touch-action-rail absolute right-2.5 bottom-[7.8rem] flex flex-col gap-3.5 items-center">
        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            className={cn(
              "touch-action-btn w-11 h-11 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-90 transition-all",
              market.userLiked ? "bg-rose-500 text-white border-rose-500" : "bg-zinc-900/60 text-white"
            )}
          >
            <Heart size={22} fill={market.userLiked ? "currentColor" : "none"} />
          </button>
          <span className="text-[10px] font-bold">{market._count.likes}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button onClick={onDetail} className="touch-action-btn w-11 h-11 rounded-full bg-zinc-900/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform">
            <MessageCircle size={22} />
          </button>
          <span className="text-[10px] font-bold">{market._count.comments}</span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          className={cn(
            "touch-action-btn w-11 h-11 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-90 transition-all",
            market.userSaved ? "bg-emerald-500 text-black border-emerald-500" : "bg-zinc-900/60 text-white"
          )}
        >
          <Bookmark size={22} fill={market.userSaved ? "currentColor" : "none"} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onShare(); }}
          className="touch-action-btn w-11 h-11 rounded-full bg-zinc-900/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          <Share2 size={22} />
        </button>
      </div>
    </motion.div>
  );
}
