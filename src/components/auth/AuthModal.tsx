import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, X } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { translations } from '../../translations';
import { apiFetch } from '../../lib/api';
import { Button } from '../ui/Button';

export function AuthModal({ onClose, onLoginSuccess }: { onClose: () => void; onLoginSuccess: (user: any) => void }) {
  const { language } = useAuthStore();
  const t = translations[language];
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initGoogle = async () => {
      try {
        const cfgRes = await apiFetch('/api/config');
        const cfg = await cfgRes.json();
        if (!cfg.googleClientId) return;

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = () => {
          if ((window as any).google?.accounts?.id) {
            (window as any).google.accounts.id.initialize({
              client_id: cfg.googleClientId,
              callback: handleGoogleResponse,
            });
            if (googleBtnRef.current) {
              (window as any).google.accounts.id.renderButton(googleBtnRef.current, {
                type: 'standard',
                theme: 'filled_black',
                size: 'large',
                width: 340,
                text: 'continue_with',
                shape: 'pill',
              });
            }
          }
        };
        document.body.appendChild(script);
      } catch {}
    };
    initGoogle();
  }, []);

  const handleGoogleResponse = async (response: any) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
      onLoginSuccess(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!email || !email.includes('@')) { setError('Enter a valid email'); return; }
    if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return; }

    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      onLoginSuccess(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-zinc-900 w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 text-center shadow-2xl relative z-[110]"
      onClick={e => e.stopPropagation()}
    >
        <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-500">
          <TrendingUp size={40} />
        </div>
        <h2 id="auth-modal-title" className="text-2xl font-bold mb-3">{mode === 'register' ? 'Create Account' : t.joinMarket}</h2>
        <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
          {mode === 'register' ? 'Sign up to start predicting and earning.' : t.authNote}
        </p>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-xl px-4 py-2 mb-4">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <Button
            className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Loading...' : mode === 'register' ? 'Sign Up' : 'Sign In'}
          </Button>

          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="text-emerald-500 text-sm font-medium hover:text-emerald-400"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-zinc-900 px-2 text-zinc-500">or</span></div>
          </div>

          <div ref={googleBtnRef} className="w-full flex justify-center" />

          <button onClick={onClose} className="text-zinc-500 text-sm font-medium mt-2 hover:text-zinc-300">{t.maybeLater}</button>
        </div>
    </motion.div>
  );
}
