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
  // Assume base amount is in RUB (Russian Rubles)
  // Current approximate exchange rate: 1 USD = 90 RUB
  const exchangeRate = 90;
  
  let displayAmount = amount;
  let currencySymbol = language === 'ru' ? "₽" : "$";
  
  if (language === 'en') {
    displayAmount = amount / exchangeRate;
  }

  const formatted = new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'decimal',
    minimumFractionDigits: language === 'en' ? 2 : 0,
    maximumFractionDigits: language === 'en' ? 2 : 0,
  }).format(displayAmount);

  const demoPrefix = language === 'ru' ? "Демо" : "Demo";
  
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
