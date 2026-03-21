import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { translations } from '../../translations';
import { cn, formatPrice } from '../../lib/utils';
import { Button, GlassCard } from '../ui/Button';
import type { Market } from '../../types/market';
import { getOutcomePercent, isPolymarket } from '../../lib/marketUtils';

export function BetModal({ market, side, userBalance, onClose, onConfirm, onRefill }: {
  market: Market;
  side: string;
  userBalance: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  onRefill?: () => void;
}) {
  const { language, isRealMode } = useAuthStore();
  const t = translations[language];
  const [amount, setAmount] = useState<number>(100);
  const chips = [50, 100, 250, 500, 1000];

  return (
    <motion.div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="bet-modal-title"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="bg-zinc-900 w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl relative z-[110]"
      onClick={e => e.stopPropagation()}
    >
        <div className="flex justify-between items-center mb-6">
          <h2 id="bet-modal-title" className="text-xl font-bold">{t.predict}</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full"><X size={20} /></button>
        </div>

        <div className="mb-6">
          <p className="text-zinc-400 text-sm mb-2">{t.predict} <span className={cn("font-bold", side === 'YES' ? "text-emerald-500" : "text-rose-500")}>{side}</span> {t.on}:</p>
          <h3 className="font-bold leading-tight">{market.title}</h3>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-end mb-4">
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{t.amount}</span>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 mb-1">
                <button 
                  onClick={() => setAmount(userBalance)}
                  className="text-[10px] font-bold bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md hover:bg-zinc-700 transition-colors"
                >
                  MAX
                </button>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                  className="bg-transparent text-right text-2xl font-bold focus:outline-none w-24 border-b border-white/10"
                />
              </div>
              <span className="text-zinc-500 text-xs">Balance: {formatPrice(userBalance, language, !isRealMode)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {chips?.map((c, i) => (
              <button 
                key={`chip-${c}-${i}`}
                onClick={() => setAmount(c)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold border transition-all",
                  amount === c ? "bg-emerald-500 border-emerald-500 text-black" : "bg-zinc-800 border-white/5 text-zinc-400"
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/5">
            {(() => {
              const pct = getOutcomePercent(market, side);
              const odds = 100 / Math.max(1, pct);
              const payout = amount / (Math.max(1, pct) / 100);
              const profit = payout - amount;
              return (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-zinc-400 text-sm">{t.odds}</span>
                    <span className="font-bold text-amber-400 text-lg">{odds.toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-zinc-400 text-sm">{t.potentialPayout}</span>
                    <span className="font-bold text-emerald-500">{formatPrice(payout, language, !isRealMode)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 text-sm">{t.potentialProfit}</span>
                    <span className="font-bold text-emerald-400">+{formatPrice(profit, language, !isRealMode)}</span>
                  </div>
                  {isPolymarket(market) && isRealMode && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <span className="text-[10px] text-zinc-500">{t.polymarketBetNote}</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <Button 
          variant={side === 'YES' ? 'primary' : side === 'NO' ? 'danger' : 'primary'}
          className="w-full py-4 rounded-2xl text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => {
            if (amount > userBalance) {
              onRefill?.();
            } else {
              onConfirm(amount);
            }
          }}
          disabled={amount <= 0}
        >
          {amount > userBalance ? `${t.topUp} & ${t.predict} ${side}` : `${t.predict} ${side}`}
        </Button>
      </motion.div>
  );
}
