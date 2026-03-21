import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Search, Trash2, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { translations } from '../translations';
import { cn, formatLocaleDate, formatPrice } from '../lib/utils';
import { apiFetch } from '../lib/api';
import { Button, GlassCard } from '../components/ui/Button';
import type { MarketProposal } from '../types/market';

export function AdminView({ onBack, onRefreshMarkets, showToast }: { onBack: () => void; onRefreshMarkets?: () => void; showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const { language } = useAuthStore();
  const t = translations[language];
  const [proposals, setProposals] = useState<MarketProposal[]>([]);
  const [activeMarkets, setActiveMarkets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminTab, setAdminTab] = useState<'proposals' | 'markets' | 'needsVideo' | 'users'>('proposals');
  
  // User search/pagination
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [showUserMenu, setShowUserMenu] = useState<string | null>(null);
  const [grantBalanceUser, setGrantBalanceUser] = useState<any | null>(null);
  const [grantWinningsUser, setGrantWinningsUser] = useState<any | null>(null);
  const [grantAmount, setGrantAmount] = useState<string>('1000');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [eventSearch, setEventSearch] = useState('');
  const [eventVideoBusyId, setEventVideoBusyId] = useState<string | null>(null);

  const fetchData = async (opts?: { silent?: boolean; usersPage?: number }) => {
    const silent = Boolean(opts?.silent);
    const effectiveUserPage = opts?.usersPage ?? userPage;
    if (!silent) setLoading(true);
    try {
      if (adminTab === 'users') {
        const res = await apiFetch(
          `/api/admin/users?search=${encodeURIComponent(userSearch)}&page=${effectiveUserPage}`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!silent) showToast((data as { error?: string }).error || 'Failed to load users', 'error');
          setUsers([]);
          setUserTotalPages(1);
          return;
        }
        setUsers((data as { users?: unknown[] }).users || []);
        setUserTotalPages((data as { pages?: number }).pages || 1);
      } else if (adminTab === 'proposals') {
        const pRes = await apiFetch('/api/proposals');
        const pData = await pRes.json().catch(() => null);
        if (!pRes.ok) {
          const msg =
            pData && typeof pData === 'object' && pData !== null && 'error' in pData
              ? String((pData as { error?: string }).error || '')
              : '';
          if (!silent) showToast(msg || 'Failed to load proposals', 'error');
          setProposals([]);
          return;
        }
        setProposals(Array.isArray(pData) ? pData : []);
      } else if (adminTab === 'needsVideo') {
        const mRes = await apiFetch(
          `/api/admin/feed-events?limit=150&needsVideo=true&search=${encodeURIComponent(eventSearch.trim())}`
        );
        const mData = await mRes.json().catch(() => null);
        if (!mRes.ok) {
          const msg =
            mData && typeof mData === 'object' && mData !== null && 'error' in mData
              ? String((mData as { error?: string }).error || '')
              : '';
          if (!silent) showToast(msg || 'Failed to load events', 'error');
          setActiveMarkets([]);
          return;
        }
        setActiveMarkets(Array.isArray(mData) ? mData : []);
      } else {
        const mRes = await apiFetch(
          `/api/admin/feed-events?limit=200&search=${encodeURIComponent(eventSearch.trim())}`
        );
        const mData = await mRes.json().catch(() => null);
        if (!mRes.ok) {
          const msg =
            mData && typeof mData === 'object' && mData !== null && 'error' in mData
              ? String((mData as { error?: string }).error || '')
              : '';
          if (!silent) showToast(msg || 'Failed to load events', 'error');
          setActiveMarkets([]);
          return;
        }
        setActiveMarkets(Array.isArray(mData) ? mData : []);
      }
    } catch (e) {
      if (adminTab === 'users') setUsers([]);
      if (adminTab === 'proposals') setProposals([]);
      if (adminTab === 'markets' || adminTab === 'needsVideo') setActiveMarkets([]);
      if (!silent) showToast('Request failed', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (adminTab === 'markets' || adminTab === 'needsVideo') return;
    void fetchData();
  }, [adminTab, userPage]);

  // Debounced user search (always request page 1 — avoids stale userPage in closure)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (adminTab === 'users') {
        setUserPage(1);
        void fetchData({ usersPage: 1 });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [userSearch, adminTab]);

  // Feed events tabs: debounce when search has text; immediate when empty
  useEffect(() => {
    if (adminTab !== 'markets' && adminTab !== 'needsVideo') return;
    const hasQuery = eventSearch.trim().length > 0;
    const delay = hasQuery ? 400 : 0;
    const timer = setTimeout(() => {
      void fetchData({ silent: hasQuery });
    }, delay);
    return () => clearTimeout(timer);
  }, [eventSearch, adminTab]);

  const patchEventVideo = async (marketId: string, videoUrl: string | null) => {
    const res = await apiFetch(`/api/admin/markets/${marketId}/video`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to save video');
    showToast(videoUrl ? 'Video saved for event' : 'Video removed', 'success');
    await fetchData({ silent: true });
  };

  const handleEventVideoFile = async (marketId: string, file: File | null) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      showToast('Video size too large. Max 50MB.', 'error');
      return;
    }
    setEventVideoBusyId(marketId);
    try {
      const formData = new FormData();
      formData.append('video', file);
      const uploadRes = await apiFetch('/api/uploads/video', { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Upload failed');
      }
      const { url } = (await uploadRes.json()) as { url?: string };
      if (!url) throw new Error('No video URL returned');
      await patchEventVideo(marketId, url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally {
      setEventVideoBusyId(null);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'delete' | 'deleteMarket') => {
    const actionKey = `${action}:${id}`;
    if (actionLoadingId) return;
    setActionLoadingId(actionKey);
    try {
      let res: Response;
      if (action === 'delete') {
        res = await apiFetch(`/api/proposals/${id}`, { method: 'DELETE' });
      } else if (action === 'deleteMarket') {
        res = await apiFetch(`/api/markets/${id}`, { method: 'DELETE' });
      } else {
        res = await apiFetch(`/api/proposals/${id}/${action}`, { method: 'POST' });
      }

      if (!res!.ok) {
        const data = await res!.json().catch(() => ({}));
        throw new Error(data.error || 'Action failed');
      }

      showToast('Updated successfully', 'success');
      await fetchData({ silent: true });
      if (action === 'deleteMarket' && onRefreshMarkets) {
        queueMicrotask(() => onRefreshMarkets());
      }
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : 'Failed to update', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const isEventsAdminTab = adminTab === 'markets' || adminTab === 'needsVideo';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full pt-6 pb-24 overflow-y-auto no-scrollbar px-6"
    >
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-zinc-900 rounded-full"><ArrowLeft size={24} /></button>
        <h2 className="text-3xl font-black tracking-tighter">{t.admin}</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 p-1 bg-zinc-900/50 rounded-xl border border-white/5">
        <button 
          onClick={() => setAdminTab('proposals')}
          className={cn(
            "py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
            adminTab === 'proposals' ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
          )}
        >
          {t.proposals}
        </button>
        <button 
          onClick={() => setAdminTab('markets')}
          className={cn(
            "py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
            adminTab === 'markets' ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
          )}
        >
          {t.adminTabMarkets}
        </button>
        <button 
          onClick={() => setAdminTab('needsVideo')}
          className={cn(
            "py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
            adminTab === 'needsVideo' ? "bg-amber-500 text-black" : "text-zinc-500 hover:text-white"
          )}
        >
          {t.adminTabNeedsVideo}
        </button>
        <button 
          onClick={() => setAdminTab('users')}
          className={cn(
            "py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
            adminTab === 'users' ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
          )}
        >
          Users
        </button>
      </div>

      {loading ? (
        <div key="admin-loading" className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : adminTab === 'proposals' ? (
        proposals.length === 0 ? (
          <div key="no-proposals" className="text-center py-12 text-zinc-500">{t.noProposals}</div>
        ) : (
          <div key="proposals-list" className="space-y-6">
            {proposals?.map((p, i) => (
              <GlassCard key={`proposal-${p.id || i}-${i}`} className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <img src={p.user.avatar} className="w-8 h-8 rounded-full" />
                    <div>
                      <div className="text-xs font-bold">@{p.user.handle}</div>
                      <div className="text-[10px] text-zinc-500">{formatLocaleDate(p.createdAt, language)}</div>
                    </div>
                  </div>
                  <div className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest",
                    p.status === 'PENDING' ? "bg-amber-500/20 text-amber-500" :
                    p.status === 'APPROVED' ? "bg-emerald-500/20 text-emerald-500" :
                    "bg-rose-500/20 text-rose-500"
                  )}>
                    {p.status === 'PENDING' ? t.pending : p.status === 'APPROVED' ? t.approved : t.rejected}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-lg leading-tight mb-2">{p.title}</h3>
                  <p className="text-sm text-zinc-400">{p.description}</p>
                </div>

                {p.videoUrl ? (
                  <div className="w-full aspect-[9/16] max-h-[300px] rounded-xl overflow-hidden border border-white/5 mx-auto">
                    <video src={p.videoUrl} className="w-full h-full object-cover pointer-events-none" autoPlay loop muted playsInline />
                  </div>
                ) : p.imageUrl && (
                  <img src={p.imageUrl} className="w-full h-full object-cover rounded-xl border border-white/5" />
                )}

                {p.status === 'PENDING' && (
                  <div className="flex gap-3 pt-2">
                    <Button variant="primary" className="flex-1 py-3" disabled={actionLoadingId === `approve:${p.id}`} onClick={() => handleAction(p.id, 'approve')}>
                      {actionLoadingId === `approve:${p.id}` ? '...' : t.approve}
                    </Button>
                    <Button variant="danger" className="flex-1 py-3" disabled={actionLoadingId === `reject:${p.id}`} onClick={() => handleAction(p.id, 'reject')}>
                      {actionLoadingId === `reject:${p.id}` ? '...' : t.reject}
                    </Button>
                  </div>
                )}

                {p.status !== 'PENDING' && (
                  <Button variant="outline" className="w-full py-2 text-xs opacity-50 hover:opacity-100" disabled={actionLoadingId === `delete:${p.id}`} onClick={() => handleAction(p.id, 'delete')}>
                    <Trash2 size={12} className="mr-2" /> {t.deleteRecord}
                  </Button>
                )}
              </GlassCard>
            ))}
          </div>
        )
      ) : isEventsAdminTab ? (
        <div key={adminTab === 'needsVideo' ? 'admin-needs-video' : 'admin-markets-wrap'} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder={t.searchFeedEventsPlaceholder}
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed">
            {adminTab === 'needsVideo' ? t.adminNeedsVideoHint : t.adminFeedEventsHint}
          </p>
          {activeMarkets.length === 0 ? (
            <div key="no-active-markets" className="text-center py-12 text-zinc-500">
              {adminTab === 'needsVideo' && !eventSearch.trim()
                ? t.allEventsHaveVideo
                : t.noEventsMatch}
            </div>
          ) : (
            <div key="active-markets-list" className="space-y-6">
              {activeMarkets?.map((m, i) => (
                <GlassCard key={`admin-market-${m.id || i}-${i}`} className="space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest bg-emerald-500/20 text-emerald-500">
                      {t.adminFeedEventBadge}
                    </div>
                    <div className="text-[10px] text-zinc-500 text-right shrink-0">
                      {m.createdAt && !Number.isNaN(Date.parse(m.createdAt))
                        ? formatLocaleDate(m.createdAt, language)
                        : m.expiresAt
                          ? formatLocaleDate(m.expiresAt, language)
                          : '—'}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg leading-tight mb-2">{m.title}</h3>
                    <p className="text-sm text-zinc-400 line-clamp-4">{m.description}</p>
                    <p className="text-[10px] text-zinc-600 font-mono mt-2 break-all">{m.id}</p>
                  </div>

                  {m.videoUrl ? (
                    <div className="w-full aspect-[9/16] max-h-[300px] rounded-xl overflow-hidden border border-white/5 mx-auto">
                      <video
                        src={m.videoUrl}
                        className="w-full h-full object-cover"
                        controls
                        playsInline
                        muted
                      />
                    </div>
                  ) : (
                    m.imageUrl && (
                      <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/5">
                        <img src={m.imageUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                      </div>
                    )
                  )}

                  <div className="flex flex-col gap-2">
                    <label className="block">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1 block">
                        Upload video (max 50MB)
                      </span>
                      <input
                        type="file"
                        accept="video/*"
                        className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-500/20 file:text-emerald-400"
                        disabled={eventVideoBusyId === m.id}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) void handleEventVideoFile(m.id, f);
                        }}
                      />
                    </label>
                    {m.videoUrl ? (
                      <Button
                        variant="outline"
                        className="w-full py-2 text-xs"
                        disabled={eventVideoBusyId === m.id}
                        onClick={() => {
                          setEventVideoBusyId(m.id);
                          patchEventVideo(m.id, null)
                            .catch((e) => showToast(e instanceof Error ? e.message : 'Failed', 'error'))
                            .finally(() => setEventVideoBusyId(null));
                        }}
                      >
                        {eventVideoBusyId === m.id ? '…' : 'Remove custom video'}
                      </Button>
                    ) : null}
                  </div>

                  <Button
                    variant="danger"
                    className="w-full py-3"
                    disabled={actionLoadingId === `deleteMarket:${m.id}`}
                    onClick={() => handleAction(m.id, 'deleteMarket')}
                  >
                    <Trash2 size={16} className="mr-2" />{' '}
                    {actionLoadingId === `deleteMarket:${m.id}` ? 'Deleting...' : 'Hide from feed'}
                  </Button>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div key="admin-users-tab" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-3 relative z-10">
            {users.map((u, i) => (
              <GlassCard 
                key={`admin-user-${u.id || i}-${i}`} 
                className={cn(
                  "flex items-center gap-4 relative overflow-visible",
                  showUserMenu === u.id ? "z-[100]" : "z-0"
                )}
              >
                <img src={u.avatar} className="w-10 h-10 rounded-xl bg-zinc-800" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">@{u.handle}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{u.email}</div>
                </div>
                <div className="text-right mr-2">
                  <div className="font-bold text-emerald-400 whitespace-nowrap">{formatPrice(u.balance, language)}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest flex flex-col items-end">
                    <span>{u.role}</span>
                    <span className="opacity-60">{u._count?.bets || 0} bets</span>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUserMenu(showUserMenu === u.id ? null : u.id);
                  }}
                  className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500"
                >
                  <MoreVertical size={20} />
                </button>

                {showUserMenu === u.id && (
                  <div className="absolute right-4 top-14 z-[9999] w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setGrantBalanceUser(u);
                        setShowUserMenu(null);
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 transition-colors border-b border-white/5"
                    >
                      {t.grantBalance}
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setGrantWinningsUser(u);
                        setShowUserMenu(null);
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 transition-colors border-b border-white/5"
                    >
                      {t.grantWinnings}
                    </button>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        const newRole = u.role === 'ADMIN' ? 'USER' : 'ADMIN';
                        await apiFetch(`/api/admin/users/${u.id}/role`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ role: newRole })
                        });
                        fetchData();
                        setShowUserMenu(null);
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 transition-colors"
                    >
                      {u.role === 'ADMIN' ? 'Revoke Admin' : 'Make Admin'}
                    </button>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>

          {userTotalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button 
                disabled={userPage === 1}
                onClick={() => setUserPage(p => p - 1)}
                className="p-2 bg-zinc-900 rounded-lg disabled:opacity-30"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm font-bold">Page {userPage} of {userTotalPages}</span>
              <button 
                disabled={userPage === userTotalPages}
                onClick={() => setUserPage(p => p + 1)}
                className="p-2 bg-zinc-900 rounded-lg disabled:opacity-30"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grant Balance Modal */}
      <AnimatePresence>
        {grantBalanceUser && (
          <div key="grant-balance-container" className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div 
              key="grant-balance-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">{t.grantBalance}</h3>
              <p className="text-zinc-400 text-sm mb-4">Granting credits to @{grantBalanceUser.handle}</p>
              
              <div className="space-y-2 mb-6">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t.grantAmount}</label>
                <input 
                  type="number" 
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/5 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setGrantBalanceUser(null)}
                >
                  {t.cancel}
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1" 
                  onClick={async () => {
                    const amount = Number(grantAmount);
                    if (!isNaN(amount) && amount > 0) {
                      const res = await apiFetch(`/api/admin/users/${grantBalanceUser.id}/balance`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount })
                      });
                      if (res.ok) {
                        fetchData();
                        setGrantBalanceUser(null);
                        showToast(t.grantBalanceSuccess, 'success');
                      } else {
                        showToast("Failed to update balance", 'error');
                      }
                    }
                  }}
                >
                  {t.confirm}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Grant Winnings Modal */}
      <AnimatePresence>
        {grantWinningsUser && (
          <div key="grant-winnings-container" className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div 
              key="grant-winnings-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">{t.grantWinnings}</h3>
              <p className="text-zinc-400 text-sm mb-4">Granting winnings to @{grantWinningsUser.handle}</p>
              
              <div className="space-y-2 mb-6">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t.grantAmount}</label>
                <input 
                  type="number" 
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/5 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setGrantWinningsUser(null)}
                >
                  {t.cancel}
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1" 
                  onClick={async () => {
                    const amount = Number(grantAmount);
                    if (!isNaN(amount) && amount > 0) {
                      const res = await apiFetch(`/api/admin/users/${grantWinningsUser.id}/winnings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount })
                      });
                      if (res.ok) {
                        showToast(t.grantWinningsSuccess, 'success');
                        setGrantWinningsUser(null);
                        fetchData();
                      } else {
                        showToast("Failed to update winnings", 'error');
                      }
                    }
                  }}
                >
                  {t.confirm}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
