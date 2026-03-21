import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' }) {
  const variants = {
    primary: 'bg-emerald-500 text-white hover:bg-emerald-600',
    secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
    danger: 'bg-rose-500 text-white hover:bg-rose-600',
    outline: 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800',
    ghost: 'text-zinc-400 hover:text-white hover:bg-zinc-800/50',
  };
  return (
    <button
      type="button"
      className={cn(
        'px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function GlassCard({ children, className, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div
      className={cn('bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}
