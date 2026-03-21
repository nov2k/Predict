import { useAuthStore } from '../store/useAuthStore';

export function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const token = useAuthStore.getState().token;
  const inputUrl = typeof input === 'string' ? input : input instanceof URL ? input.pathname : '';
  const isApiCall = typeof inputUrl === 'string' && inputUrl.startsWith('/api');
  if (!token || !isApiCall) {
    return fetch(input, init);
  }

  const headers = new Headers(init?.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

/** Only allow https payment redirects to NOWPayments (defense in depth vs malicious payment_url). */
export function isTrustedNowpaymentsPaymentUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return host === 'nowpayments.io' || host.endsWith('.nowpayments.io');
  } catch {
    return false;
  }
}
