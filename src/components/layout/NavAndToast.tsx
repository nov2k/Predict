import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "touch-nav-btn flex flex-col items-center gap-1 transition-colors",
        active ? "text-emerald-500" : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      {icon}
      <span className="touch-nav-label text-[10px] font-medium uppercase tracking-widest leading-none">{label}</span>
    </button>
  );
}

export function SidebarNavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 w-full px-4 py-3 rounded-xl transition-all font-bold text-sm",
        active 
          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
          : "text-zinc-400 hover:text-white hover:bg-white/5"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md"
    >
      <div className={cn(
        "px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md",
        type === 'success' ? "bg-emerald-500/90 border-emerald-400 text-white" :
        type === 'error' ? "bg-rose-500/90 border-rose-400 text-white" :
        "bg-zinc-900/90 border-white/10 text-white"
      )}>
        {type === 'success' && <CheckCircle2 size={18} />}
        {type === 'error' && <AlertCircle size={18} />}
        {type === 'info' && <Info size={18} />}
        <span className="text-sm font-bold flex-1">{message}</span>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full">
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}
