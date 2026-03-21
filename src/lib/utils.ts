import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type AppLanguage = 'en' | 'ru';

/** Formats a date for list rows / comments (locale follows app language). */
export function formatLocaleDate(
  date: Date | string | number,
  language: AppLanguage,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const locale = language === 'ru' ? 'ru-RU' : 'en-US';
  return d.toLocaleDateString(locale, options);
}

/** e.g. 19 Mar */
export function formatShortMonthDay(date: Date | string | number, language: AppLanguage): string {
  return formatLocaleDate(date, language, { day: 'numeric', month: 'short' });
}

/** e.g. 19 Mar 2026 */
export function formatShortMonthDayYear(date: Date | string | number, language: AppLanguage): string {
  return formatLocaleDate(date, language, { day: 'numeric', month: 'short', year: 'numeric' });
}

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatPrice = (amount: number, language: 'en' | 'ru', isDemo: boolean = false) => {
  const currencySymbol = "$";

  const formatted = new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'decimal',
    minimumFractionDigits: amount % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);

  const demoPrefix = language === 'ru' ? "Демо" : "Demo";

  if (isDemo) return `${demoPrefix} ${currencySymbol}${formatted}`;
  return `${currencySymbol}${formatted}`;
};

/** Logs an analytics event. `userId` on the server comes from the session (Bearer token), not from this payload — pass extra context only inside `metadata`. */
export const trackEvent = async (eventName: string, metadata?: Record<string, unknown>) => {
  try {
    const token = (() => {
      try {
        const persisted = localStorage.getItem('auth-storage');
        if (!persisted) return null;
        const parsed = JSON.parse(persisted);
        return parsed?.state?.token || null;
      } catch {
        return null;
      }
    })();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await fetch('/api/analytics', {
      method: 'POST',
      headers,
      body: JSON.stringify({ eventName, metadata }),
    });
  } catch (e) {
    console.error('Failed to track event', e);
  }
};
