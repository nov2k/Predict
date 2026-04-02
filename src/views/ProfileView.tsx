import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Info, Heart, Trophy, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { translations } from '../translations';
import { cn, formatPrice } from '../lib/utils';
import { GlassCard } from '../components/ui/Button';

export function ProfileView({ user, onLogout, onSavedClick, onAdminClick, onTopUp }: { user: any; onLogout: () => void; onSavedClick: () => void; onAdminClick: () => void; onTopUp: () => void }) {
  const { language, setLanguage, isRealMode, setIsRealMode, demoBalance } = useAuthStore();
  const t = translations[language];

  const winRate = '—';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full pt-6 pb-24 overflow-y-auto no-scrollbar px-6"
    >
      <div className="flex flex-col items-center mb-8">
        <div className="relative mb-4">
          <img src={user.avatar} className="w-24 h-24 rounded-[2rem] bg-zinc-800 border-2 border-emerald-500/20" />
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-black p-1.5 rounded-xl shadow-lg">
            <CheckCircle2 size={16} />
          </div>
        </div>
        <h2 className="text-2xl font-black tracking-tight">@{user.handle}</h2>
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">{user.role === 'ADMIN' ? t.roleAdmin : t.roleUser}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <GlassCard 
          onClick={onTopUp}
          className="flex flex-col items-center py-6 relative overflow-hidden group cursor-pointer hover:bg-white/5 transition-colors"
        >
          <span className="text-3xl font-black text-emerald-400 whitespace-nowrap">{formatPrice(isRealMode ? user.balance : demoBalance, language)}</span>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{t.credits}</span>
          <div className="absolute inset-x-0 bottom-0 bg-emerald-500 text-black text-[10px] font-black py-1 uppercase tracking-tighter translate-y-full group-hover:translate-y-0 transition-transform text-center">
            {t.topUp}
          </div>
        </GlassCard>
        <GlassCard className="flex flex-col items-center py-6">
          <span className="text-3xl font-black whitespace-nowrap">{winRate}</span>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{t.winRate}</span>
        </GlassCard>
      </div>

      <div className="space-y-3">
        <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"><TrendingUp size={20} /></div>
            <span className="font-bold">{t.demo} / {t.live}</span>
          </div>
          <div className="flex bg-zinc-800 rounded-lg p-1">
            <button 
              onClick={() => setIsRealMode(false)}
              className={cn("px-3 py-1 rounded-md text-xs font-bold transition-all", !isRealMode ? "bg-emerald-500 text-black" : "text-zinc-500")}
            >
              {t.demo}
            </button>
            <button 
              onClick={() => {
                setIsRealMode(true);
              }}
              className={cn("px-3 py-1 rounded-md text-xs font-bold transition-all", isRealMode ? "bg-emerald-500 text-black" : "text-zinc-500")}
            >
              {t.live}
            </button>
          </div>
        </div>
        <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"><Info size={20} /></div>
            <span className="font-bold">{t.language}</span>
          </div>
          <div className="flex bg-zinc-800 rounded-lg p-1">
            <button 
              onClick={() => setLanguage('en')}
              className={cn("px-3 py-1 rounded-md text-xs font-bold transition-all", language === 'en' ? "bg-emerald-500 text-black" : "text-zinc-500")}
            >
              EN
            </button>
            <button 
              onClick={() => setLanguage('ru')}
              className={cn("px-3 py-1 rounded-md text-xs font-bold transition-all", language === 'ru' ? "bg-emerald-500 text-black" : "text-zinc-500")}
            >
              RU
            </button>
          </div>
        </div>
        <button className="w-full bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between hover:bg-zinc-800/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"><TrendingUp size={20} /></div>
            <span className="font-bold">{t.statistics}</span>
          </div>
          <ArrowUpRight size={20} className="text-zinc-600" />
        </button>
        <button 
          onClick={onSavedClick}
          className="w-full bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"><Heart size={20} /></div>
            <span className="font-bold">{t.saved}</span>
          </div>
          <ArrowUpRight size={20} className="text-zinc-600" />
        </button>
        {user?.role === 'ADMIN' && (
          <button
            onClick={onAdminClick}
            className="w-full bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"><Trophy size={20} /></div>
              <span className="font-bold">{t.admin}</span>
            </div>
            <ArrowUpRight size={20} className="text-zinc-600" />
          </button>
        )}
        <button 
          onClick={onLogout}
          className="w-full bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center justify-center gap-3 text-rose-500 font-bold mt-8"
        >
          {t.logout}
        </button>
      </div>
    </motion.div>
  );
}
