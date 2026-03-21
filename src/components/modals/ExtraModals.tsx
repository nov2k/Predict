import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Wallet, CheckCircle2, TrendingUp, X, Plus, ArrowUpRight, Bitcoin, Coins, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { translations } from '../../translations';
import { cn, formatPrice, trackEvent } from '../../lib/utils';
import { apiFetch, isTrustedNowpaymentsPaymentUrl } from '../../lib/api';
import { Button } from '../ui/Button';

export function WaitlistModal({ onClose }: { onClose: () => void }) {
  const { language } = useAuthStore();
  const t = translations[language];
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, intendedAmount: 100 })
    });
    setSubmitted(true);
    trackEvent('waitlist_submission', { email });
  };

  return (
    <motion.div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-modal-title"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-zinc-900 w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 text-center shadow-2xl relative z-[110]"
      onClick={e => e.stopPropagation()}
    >
      {!submitted ? (
          <>
            <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-500">
              <Wallet size={40} />
            </div>
            <h2 id="waitlist-modal-title" className="text-2xl font-bold mb-3">{t.comingSoon}</h2>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              {t.waitlistNote}
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input 
                type="email" 
                placeholder={t.enterEmail} 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <Button type="submit" className="w-full py-4 rounded-2xl font-bold">{t.joinWaitlist}</Button>
              <button type="button" onClick={onClose} className="text-zinc-500 text-sm font-medium mt-4 hover:text-zinc-300">{t.backToDemo}</button>
            </form>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 text-black">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-bold mb-3">{t.onList}</h2>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              {t.launchNote}
            </p>
            <Button className="w-full py-4 rounded-2xl font-bold" onClick={onClose}>{t.gotIt}</Button>
          </>
        )}
    </motion.div>
  );
}

export function BetConfirmation({ side, amount }: { side: string; amount: number }) {
  const { language } = useAuthStore();
  const t = translations[language];
  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className="fixed top-24 left-0 right-0 z-[250] flex justify-center pointer-events-none px-6"
    >
      <div className="bg-zinc-900/90 backdrop-blur-xl border border-emerald-500/30 px-6 py-4 rounded-3xl flex items-center gap-4 shadow-2xl shadow-emerald-500/20 max-w-sm w-full">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center text-black shadow-lg shrink-0",
          side === 'YES' ? "bg-emerald-500 shadow-emerald-500/40" : "bg-rose-500 shadow-rose-500/40"
        )}>
          <TrendingUp size={24} className={side === 'NO' ? "rotate-180" : ""} />
        </div>
        <div className="flex flex-col">
          <h3 className="text-emerald-400 font-black text-sm uppercase tracking-wider">{t.betConfirmed}</h3>
          <p className="text-white font-bold text-lg">
            {side} <span className="text-zinc-500 text-xs font-medium ml-1">{t.betAmountPrefix} {formatPrice(amount, language)}</span>
          </p>
        </div>
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="ml-auto text-emerald-500"
        >
          <CheckCircle2 size={24} />
        </motion.div>
      </div>
    </motion.div>
  );
}

export function WelcomeModal({ onClose, onTopUp }: { onClose: () => void; onTopUp: () => void }) {
  const { language } = useAuthStore();
  const t = translations[language];

  return (
    <motion.div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      className="bg-zinc-900 w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 text-center shadow-2xl relative z-[310]"
      onClick={e => e.stopPropagation()}
    >
      <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-500">
        <Wallet size={40} />
      </div>
      <h2 id="welcome-modal-title" className="text-2xl font-bold mb-3">{t.welcomeTitle}</h2>
      <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
        {t.welcomeNote}
      </p>
      <div className="flex flex-col gap-3">
        <Button className="w-full py-4 rounded-2xl font-bold" onClick={onTopUp}>
          {t.topUp}
        </Button>
        <button onClick={onClose} className="text-zinc-500 text-sm font-medium mt-2 hover:text-zinc-300">{t.maybeLater}</button>
      </div>
    </motion.div>
  );
}

export function WithdrawTab({ userId, balance, onClose }: { userId?: string; balance: number; onClose: () => void }) {
  const { language } = useAuthStore();
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleWithdraw = async () => {
    const num = Number(amount);
    if (!num || num <= 0) { setError('Enter a valid amount'); return; }
    if (num > balance) { setError('Insufficient balance'); return; }
    if (!address || address.length < 10) { setError('Enter a valid wallet address'); return; }
    setLoading(true); setError('');
    try {
      const res = await apiFetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: num, address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="py-8 flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>
        <h3 className="text-lg font-bold">Withdrawal Requested</h3>
        <p className="text-zinc-400 text-sm">Your withdrawal of {formatPrice(Number(amount), language)} is being processed. You'll receive funds within 24 hours.</p>
        <Button className="w-full py-3 rounded-2xl font-bold mt-4" onClick={onClose}>Done</Button>
      </div>
    );
  }

  const num = Number(amount) || 0;
  const fee = Math.max(1, num * 0.05);
  const totalDeducted = num + fee;
  const youReceive = num;

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <span className="text-zinc-500 text-xs">Available Balance</span>
        <div className="text-2xl font-bold text-white">{formatPrice(balance, language)}</div>
      </div>
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-xl px-4 py-2">{error}</div>}
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount to withdraw"
        className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:border-emerald-500"
      />
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Wallet address (USDC / Polygon)"
        className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
      />
      {num > 0 && (
        <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">You receive</span>
            <span className="font-bold text-white">{formatPrice(youReceive, language)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Fee (5%)</span>
            <span className="font-bold text-rose-400">-{formatPrice(fee, language)}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-white/5">
            <span className="text-zinc-400">Total deducted</span>
            <span className="font-bold text-white">{formatPrice(totalDeducted, language)}</span>
          </div>
        </div>
      )}
      <p className="text-[10px] text-zinc-500">Withdrawals processed within 24h. Min $10. Fee: 5% (min $1).</p>
      <Button
        className="w-full py-4 rounded-2xl font-bold disabled:opacity-50"
        onClick={handleWithdraw}
        disabled={loading || !amount || !address || num < 10 || totalDeducted > balance}
      >
        {loading ? 'Processing...' : num > 0 && totalDeducted > balance ? 'Insufficient balance' : 'Request Withdrawal'}
      </Button>
    </div>
  );
}

export function WalletModal({ onClose, onSuccess, showToast }: { onClose: () => void; onSuccess: (amount: number) => void; showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const { user, language, isRealMode } = useAuthStore();
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<string>('1000');
  const [loading, setLoading] = useState(false);
  const amounts = [500, 1000, 2500, 5000, 10000];

  const handlePayment = async () => {
    if (!user?.id || activeTab === 'withdraw') return;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setLoading(true);
    try {
      const res = await apiFetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numAmount })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast((data as { error?: string }).error || 'Payment could not be started', 'error');
        return;
      }
      if (data.payment_url) {
        if (!data.mock && !isTrustedNowpaymentsPaymentUrl(String(data.payment_url))) {
          showToast('Blocked unsafe payment URL', 'error');
          return;
        }
        const win = window.open(data.payment_url, '_blank');
        if (!win) {
          window.location.href = data.payment_url;
        }

        if (data.mock) {
          setTimeout(async () => {
            onSuccess(numAmount);
          }, 3000);
        }
      } else {
        showToast('No payment URL returned', 'error');
      }
    } catch (error) {
      console.error("Payment error:", error);
      showToast('Payment error', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      className="bg-zinc-900 w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 shadow-2xl relative z-[310]"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-6">
        <h2 id="wallet-modal-title" className="text-xl font-bold">{t.wallet}</h2>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full"><X size={20} /></button>
      </div>

      {!isRealMode && (
        <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-200/80 leading-relaxed font-medium">
            You are currently in Demo Mode. Deposits will be credited to your main balance.
          </p>
        </div>
      )}

      <div className="flex gap-2 mb-8 p-1 bg-zinc-800/50 rounded-2xl border border-white/5">
        <button 
          onClick={() => setActiveTab('deposit')}
          className={cn(
            "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2",
            activeTab === 'deposit' ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
          )}
        >
          <Plus size={14} />
          {t.deposit}
        </button>
        <button 
          onClick={() => setActiveTab('withdraw')}
          className={cn(
            "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2",
            activeTab === 'withdraw' ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"
          )}
        >
          <ArrowUpRight size={14} />
          {t.withdraw}
        </button>
      </div>

      {activeTab === 'deposit' ? (
        <div className="space-y-6">
          <div className="text-left">
            <div className="flex justify-between items-center mb-4">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{t.customAmount}</span>
              <span className="text-2xl font-bold text-emerald-500">{formatPrice(Number(amount) || 0, language)}</span>
            </div>
            <div className="relative">
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t.enterAmount}
                className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {amounts.map((a) => (
              <button 
                key={`amount-${a}`}
                onClick={() => setAmount(String(a))}
                className={cn(
                  "flex-1 min-w-[80px] py-3 rounded-xl text-sm font-bold border transition-all",
                  amount === String(a) ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-zinc-800 border-white/5 text-zinc-400"
                )}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="bg-zinc-800/30 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center border-2 border-zinc-900"><Bitcoin size={16} className="text-white" /></div>
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center border-2 border-zinc-900"><Coins size={16} className="text-white" /></div>
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-zinc-900"><Wallet size={16} className="text-white" /></div>
            </div>
            <p className="text-[10px] text-zinc-500 font-medium text-left leading-tight">
              {t.cryptoNote}
            </p>
          </div>

          <Button 
            className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3" 
            onClick={handlePayment}
            disabled={loading || !amount || Number(amount) <= 0}
          >
            {loading ? t.processing : t.payNow}
          </Button>
        </div>
      ) : (
        <WithdrawTab userId={user?.id} balance={user?.balance || 0} onClose={onClose} />
      )}
    </motion.div>
  );
}

export function DepositSuccessModal({ amount }: { amount: number }) {
  const { language } = useAuthStore();
  const t = translations[language];
  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className="fixed top-24 left-0 right-0 z-[250] flex justify-center pointer-events-none px-6"
    >
      <div className="bg-zinc-900/90 backdrop-blur-xl border border-emerald-500/30 px-6 py-4 rounded-3xl flex items-center gap-4 shadow-2xl shadow-emerald-500/20 max-w-sm w-full">
        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-black shadow-lg shadow-emerald-500/40 shrink-0">
          <Wallet size={24} />
        </div>
        <div className="flex flex-col">
          <h3 className="text-emerald-400 font-black text-sm uppercase tracking-wider">{t.depositSuccess}</h3>
          <p className="text-white font-bold text-lg">
            +{formatPrice(amount, language)} <span className="text-zinc-500 text-xs font-medium ml-1">{t.depositAmount}</span>
          </p>
        </div>
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="ml-auto text-emerald-500"
        >
          <CheckCircle2 size={24} />
        </motion.div>
      </div>
    </motion.div>
  );
}
