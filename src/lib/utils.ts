import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatPrice = (amount: number, language: 'en' | 'ru', isDemo: boolean = false) => {
  const formatted = formatCurrency(amount);
  const demoPrefix = language === 'ru' ? "Демо" : "Demo";
  const currencySymbol = language === 'ru' ? "₽" : "$";
  
  if (isDemo) return `${demoPrefix} ${formatted}`;
  return language === 'ru' ? `${formatted} ${currencySymbol}` : `${currencySymbol}${formatted}`;
};

export const trackEvent = async (eventName: string, userId?: string, metadata?: any) => {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName, userId, metadata }),
    });
  } catch (e) {
    console.error('Failed to track event', e);
  }
};
