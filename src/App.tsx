import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  TrendingUp,
  Search,
  X,
  Wallet,
  Plus,
  History,
  User as UserIcon,
  Trophy,
} from 'lucide-react';
import { cn, formatPrice, trackEvent } from './lib/utils';
import { useAuthStore } from './store/useAuthStore';
import { translations } from './translations';
import type { AppView, Market } from './types/market';
import { apiFetch } from './lib/api';
import { Button } from './components/ui/Button';
import { getCategories, type CategoryItem } from './constants/categories';
import { NavButton, SidebarNavButton, Toast } from './components/layout/NavAndToast';
import { RankingView } from './views/RankingView';
import { HistoryView } from './views/HistoryView';
import { ProfileView } from './views/ProfileView';
import { SavedView } from './views/SavedView';
import { CreateView } from './views/CreateView';
import { AdminView } from './views/AdminView';
import { MarketCard } from './components/market/MarketCard';
import { BetModal } from './components/market/BetModal';
import { AuthModal } from './components/auth/AuthModal';
import { MarketDetail } from './components/market/MarketDetail';
import {
  WaitlistModal,
  BetConfirmation,
  WelcomeModal,
  WalletModal,
  DepositSuccessModal,
} from './components/modals/ExtraModals';


export default function App() {
  const { user, token, isLoggedIn, setUser, setToken, language, setLanguage, isRealMode, setIsRealMode, demoBalance, setDemoBalance } = useAuthStore();
  const t = translations[language];
  const [markets, setMarkets] = useState<Market[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentView, setCurrentView] = useState<AppView>('feed');
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBetModal, setShowBetModal] = useState<{ market: Market; side: string } | null>(null);
  const [showDetail, setShowDetail] = useState<Market | null>(null);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [confirmBet, setConfirmBet] = useState<{ side: string; amount: number } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'up' | 'down' | null>(null);
  const [showDepositSuccess, setShowDepositSuccess] = useState<{ amount: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [selectedCategory, setSelectedCategory] = useState<CategoryItem | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const isSharing = useRef(false);
  const verifyUserSeq = useRef(0);

  useEffect(() => {
    if (user && !token) {
      useAuthStore.getState().logout();
    }
  }, [user, token]);

  useEffect(() => {
    if (!user?.id) return;
    const seq = ++verifyUserSeq.current;
    const uid = user.id;
    (async () => {
      try {
        const res = await apiFetch(`/api/users/${uid}`);
        if (seq !== verifyUserSeq.current) return;
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          console.log("User session invalid (not in DB), logging out...");
          useAuthStore.getState().logout();
        } else if (res.ok) {
          const updatedUser = await res.json();
          if (seq !== verifyUserSeq.current) return;
          setUser(updatedUser);
        }
      } catch (e) {
        console.error("Failed to verify user:", e);
      }
    })();
  }, [user?.id, setUser]);

  // Auto-refresh balance every 30s (read fresh user from store to avoid stale closures)
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(async () => {
      try {
        const uid = useAuthStore.getState().user?.id;
        if (!uid) return;
        const res = await apiFetch(`/api/users/${uid}`);
        if (res.ok) {
          const data = await res.json();
          const cur = useAuthStore.getState().user;
          if (cur && data.balance !== cur.balance) {
            useAuthStore.getState().setUser({ ...cur, ...data });
          }
        } else if (res.status === 401 || res.status === 403) {
          useAuthStore.getState().logout();
        }
      } catch {
        /* ignore */
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const loadingMore = useRef(false);
  const hasMore = useRef(true);
  const fetchVersion = useRef(0);

  const fetchMarkets = async (categorySearch: string | undefined, append: boolean, version: number) => {
    if (append && (loadingMore.current || !hasMore.current)) return;
    if (append) loadingMore.current = true;
    try {
      const offset = append ? markets.length : 0;
      let url = `/api/markets?limit=100&offset=${offset}`;
      if (categorySearch) {
        url += `&search=${encodeURIComponent(categorySearch)}`;
      }
      const res = await apiFetch(url);
      if (version !== fetchVersion.current) return; // stale request

      if (user?.id && (res.status === 401 || res.status === 404)) {
        setUser(null);
        return;
      }

      const data = await res.json();
      if (version !== fetchVersion.current) return; // stale request

      if (!res.ok) {
        if (!append) {
          setMarkets([]);
          showToast(t.feedLoadError, 'error');
        } else {
          showToast(t.feedLoadMoreError, 'error');
        }
        return;
      }

      if (Array.isArray(data)) {
        if (append) {
          const newMarkets = data.filter((m: any) => !markets.some(em => em.id === m.id));
          if (newMarkets.length === 0) hasMore.current = false;
          else setMarkets(prev => [...prev, ...newMarkets]);
        } else {
          setMarkets(data);
          hasMore.current = data.length >= 100;
        }
      }
    } catch (e) {
      console.error('Failed to fetch markets:', e);
      if (!append) {
        setMarkets([]);
        showToast(t.feedLoadError, 'error');
      } else {
        showToast(t.feedLoadMoreError, 'error');
      }
    } finally {
      loadingMore.current = false;
    }
  };

  useEffect(() => {
    hasMore.current = true;
    fetchVersion.current++;
    const v = fetchVersion.current;
    setMarkets([]);
    setCurrentIndex(0);
    fetchMarkets(selectedCategory?.search, false, v);
    trackEvent('app_load');
  }, [user?.id, selectedCategory]);

  // Load more when approaching end of feed
  useEffect(() => {
    if (markets.length > 0 && currentIndex >= markets.length - 5 && hasMore.current) {
      fetchMarkets(selectedCategory?.search, true, fetchVersion.current);
    }
  }, [currentIndex, markets.length]);

  useEffect(() => {
    if (markets.length > 0) {
      if (currentIndex >= markets.length) {
        setCurrentIndex(markets.length - 1);
      } else if (currentIndex < 0) {
        setCurrentIndex(0);
      }
    }
  }, [markets.length, currentIndex]);

  const handleRefill = () => {
    if (!isRealMode) {
      setDemoBalance(10000);
      showToast(t.demoRefilled, 'success');
      return;
    }
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    setShowBetModal(null);
    setShowTopUpModal(true);
  };

  const handleBetClick = (market: Market, side: string) => {
    if (!market) return;
    if (!isLoggedIn) {
      setShowAuthModal(true);
      trackEvent('login_wall_shown', { marketId: market.id });
      return;
    }
    setShowBetModal({ market, side });
    trackEvent('bet_click', { marketId: market.id, side });
  };

  const onConfirmBet = async (amount: number) => {
    if (!showBetModal) return;
    
    const side = showBetModal.side;
    const market = showBetModal.market;

    if (!isLoggedIn || !user?.id) {
      setShowAuthModal(true);
      return;
    }

    if (!isRealMode) {
      // Demo mode logic
      if (amount > demoBalance) {
        showToast(t.insufficientDemoBalance, 'error');
        return;
      }
      setDemoBalance(demoBalance - amount);
      setConfirmBet({ side, amount });
      setShowBetModal(null);
      showToast(t.demoBetSuccess, 'success');
      return;
    }

    try {
      const res = await apiFetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: market.id,
          amount,
          side
        })
      });
      
      if (!res.ok) {
        let errorMsg = 'Failed to place bet';
        try {
          const clone = res.clone();
          const errorData = await clone.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          const text = await res.text();
          console.error("Server returned non-JSON error:", text);
          errorMsg = `Server error: ${res.status}`;
        }
        
        if (res.status === 401 || errorMsg.includes("User not found")) {
          useAuthStore.getState().logout();
          setShowAuthModal(true);
        } else if (errorMsg.includes("Insufficient balance")) {
          showToast(t.insufficientBalance, 'error');
          setShowBetModal(null);
          setShowTopUpModal(true);
          return;
        } else {
          showToast(errorMsg, 'error');
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (data.bet) {
        setUser({ ...user!, balance: data.balance });
        setConfirmBet({ side, amount });
        trackEvent('bet_success', { marketId: market.id, amount, side });
        
        // Trigger confetti for real bet
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#10b981', '#34d399', '#059669', '#ffffff']
        });

        // Update the market in the list
        if (data.market) {
          setMarkets(prev => prev.map(m => m.id === data.market.id ? { ...data.market, userLiked: m.userLiked, userSaved: m.userSaved } : m));
          if (showDetail?.id === data.market.id) {
            setShowDetail({ ...data.market, userLiked: showDetail.userLiked, userSaved: showDetail.userSaved });
          }
        }

        // Auto-like if not already liked
        if (!market.userLiked) {
          handleLike(market.id);
        }

        setTimeout(() => setConfirmBet(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
    setShowBetModal(null);
  };

  const handleLoginSuccess = (data: any) => {
    const { token, isNewUser, ...userData } = data;
    setToken(token || null);
    setUser(userData);
    setIsRealMode(true);
    setShowAuthModal(false);
    trackEvent('login_success', { userId: userData.id });
    if (isNewUser) {
      setShowWelcomeModal(true);
    }
  };

  const lastSwipeAt = useRef(0);
  const handleSwipe = (direction: 'up' | 'down') => {
    const now = Date.now();
    if (now - lastSwipeAt.current < 350) return;
    lastSwipeAt.current = now;

    if (direction === 'up') {
      if (currentIndex < markets.length - 1) {
        setSwipeDirection('up');
        setCurrentIndex(prev => prev + 1);
        trackEvent('swipe_up', { index: currentIndex + 1 });
      } else {
        setSwipeDirection('up');
      }
    } else if (direction === 'down') {
      if (currentIndex > 0) {
        setSwipeDirection('down');
        setCurrentIndex(prev => prev - 1);
        trackEvent('swipe_down', { index: currentIndex - 1 });
      } else {
        setSwipeDirection('down');
      }
    }

    setTimeout(() => setSwipeDirection(null), 400);
  };

  const handleLike = async (marketId: string) => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }

    // Optimistic update in parent state
    setMarkets(prev => prev.map(m => {
      if (m.id === marketId) {
        const newLiked = !m.userLiked;
        return {
          ...m,
          userLiked: newLiked,
          _count: {
            ...m._count,
            likes: Math.max(0, m._count.likes + (newLiked ? 1 : -1))
          }
        };
      }
      return m;
    }));

    try {
      const res = await apiFetch(`/api/markets/${marketId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error || 'Failed to toggle like';
        if (res.status === 401 || errorMsg.includes("User not found")) {
          useAuthStore.getState().logout();
          setShowAuthModal(true);
        }
        throw new Error(errorMsg);
      }
      
      // Sync with server response if needed (optional but safer)
      setMarkets(prev => prev.map(m => {
        if (m.id === marketId) {
          return {
            ...m,
            userLiked: data.liked
          };
        }
        return m;
      }));
      if (showDetail?.id === marketId) {
        setShowDetail(prev => prev ? { ...prev, userLiked: data.liked } : null);
      }
    } catch (e) {
      // Rollback on error
      setMarkets(prev => prev.map(m => {
        if (m.id === marketId) {
          const revertedLiked = !m.userLiked;
          return {
            ...m,
            userLiked: revertedLiked,
            _count: {
              ...m._count,
              likes: Math.max(0, m._count.likes + (revertedLiked ? 1 : -1))
            }
          };
        }
        return m;
      }));
      console.error(e);
    }
  };

  const handleSave = async (marketId: string) => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }

    // Optimistic update
    setMarkets(prev => prev.map(m => {
      if (m.id === marketId) {
        return { ...m, userSaved: !m.userSaved };
      }
      return m;
    }));

    try {
      const res = await apiFetch(`/api/markets/${marketId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error || 'Failed to toggle save';
        if (res.status === 401 || errorMsg.includes("User not found")) {
          useAuthStore.getState().logout();
          setShowAuthModal(true);
        }
        throw new Error(errorMsg);
      }
      setMarkets(prev => prev.map(m => {
        if (m.id === marketId) {
          return { ...m, userSaved: data.saved };
        }
        return m;
      }));
      if (showDetail?.id === marketId) {
        setShowDetail(prev => prev ? { ...prev, userSaved: data.saved } : null);
      }
    } catch (e) {
      // Rollback
      setMarkets(prev => prev.map(m => {
        if (m.id === marketId) {
          return { ...m, userSaved: !m.userSaved };
        }
        return m;
      }));
      console.error(e);
    }
  };

  const handleShare = async (market: Market) => {
    if (isSharing.current) return;

    const shareData = {
      title: market.title,
      text: t.shareMarketText.replace('{title}', market.title),
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        isSharing.current = true;
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast(t.shareSuccess, 'success');
      }
    } catch (err) {
      // Handle cancellation or concurrent share attempts gracefully
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          // User canceled the share dialog - this is expected behavior
          return;
        }
        if (err.message.includes('earlier share has not yet completed')) {
          // This should be prevented by isSharing.current, but handle it just in case
          return;
        }
      }
      console.error('Error sharing:', err);
    } finally {
      isSharing.current = false;
    }
  };

  const renderView = () => {
    if (markets.length === 0 && currentView === 'feed') {
      return (
        <div key="loading-markets" className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <TrendingUp size={32} className="text-zinc-700" />
          </div>
          <h3 className="text-xl font-bold mb-2">{t.loadingMarketsTitle}</h3>
          <p className="text-zinc-500 text-sm">{t.loadingMarketsSubtitle}</p>
        </div>
      );
    }

    const safeIndex = Math.min(Math.max(0, currentIndex), markets.length - 1);
    const currentMarket = markets[safeIndex];

    switch (currentView) {
      case 'feed':
        return (
          <AnimatePresence initial={false} custom={swipeDirection}>
          {currentMarket ? (
            <MarketCard 
              key={`market-${currentMarket.id}-${safeIndex}`}
              market={currentMarket}
              direction={swipeDirection}
              onDetail={() => setShowDetail(currentMarket)}
              onSwipe={handleSwipe}
              onLike={() => handleLike(currentMarket.id)}
              onSave={() => handleSave(currentMarket.id)}
              onShare={() => handleShare(currentMarket)}
              isFirst={safeIndex === 0}
              isLast={safeIndex === markets.length - 1}
            />
          ) : (
            <div key="no-market" className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black">
              <TrendingUp size={48} className="text-zinc-800 mb-4" />
              <h3 className="text-xl font-bold mb-2">{t.endOfFeedTitle}</h3>
              <p className="text-zinc-500 text-sm">{t.endOfFeedSubtitle}</p>
              <Button variant="primary" className="mt-6" onClick={() => setCurrentIndex(0)}>{t.backToTop}</Button>
            </div>
          )}
          </AnimatePresence>
        );
      case 'rank':
        return <RankingView />;
      case 'create':
        return <CreateView onClose={() => setCurrentView('feed')} showToast={showToast} />;
      case 'history':
        return <HistoryView userId={user?.id} />;
      case 'profile':
        return (
          <ProfileView 
            user={user} 
            onLogout={() => { useAuthStore.getState().logout(); setCurrentView('feed'); }} 
            onSavedClick={() => setCurrentView('saved')} 
            onAdminClick={() => setCurrentView('admin')}
            onTopUp={() => setShowTopUpModal(true)}
          />
        );
      case 'saved':
        return <SavedView userId={user?.id} onBack={() => setCurrentView('profile')} onMarketClick={(m) => setShowDetail(m)} />;
      case 'admin':
        return <AdminView onBack={() => setCurrentView('profile')} onRefreshMarkets={() => fetchMarkets(selectedCategory?.search, false, fetchVersion.current)} showToast={showToast} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-full bg-black text-white overflow-hidden flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[60] p-4 flex items-center justify-between bg-black/20 lg:bg-gradient-to-b lg:from-black/90 lg:to-transparent backdrop-blur-md">
        <div className="flex items-center gap-6 lg:gap-12 w-full max-w-[1400px] mx-auto">
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => { setCurrentView('feed'); setSelectedCategory(null); }}>
            <div className="flex flex-col leading-none">
              <span className="font-black text-xl lg:text-2xl tracking-tighter text-emerald-500 italic">Predi</span>
              <span className="font-bold text-[10px] lg:text-[12px] tracking-[0.2em] text-zinc-500 uppercase ml-0.5">Club</span>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Category Selector */}
              <div className="relative">
                <button 
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-sm font-medium",
                    selectedCategory 
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                      : "bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 border border-white/5"
                  )}
                >
                  {selectedCategory ? selectedCategory.icon : <Search size={16} />}
                  <span>{selectedCategory ? (selectedCategory.name.length > 8 ? selectedCategory.name.slice(0, 8) + '..' : selectedCategory.name) : t.categoriesLabel}</span>
                  {selectedCategory && (
                    <X 
                      size={14} 
                      className="ml-1 hover:scale-110 transition-transform" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCategory(null);
                      }}
                    />
                  )}
                </button>

                <AnimatePresence>
                  {showCategoryDropdown && [
                    <motion.div 
                      key="category-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm lg:hidden"
                      onClick={() => setShowCategoryDropdown(false)}
                    />,
                    <motion.div 
                      key="category-dropdown"
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="absolute top-full left-0 mt-2 w-[280px] lg:w-[320px] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[80] overflow-hidden"
                    >
                      <div className="p-2 grid grid-cols-1 gap-1 max-h-[70vh] overflow-y-auto no-scrollbar">
                        {getCategories(t).map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              setSelectedCategory(cat);
                              setShowCategoryDropdown(false);
                            }}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl transition-all text-left group",
                              selectedCategory?.id === cat.id 
                                ? "bg-emerald-500 text-white" 
                                : "hover:bg-white/5 text-zinc-300 hover:text-white"
                            )}
                          >
                            <div className={cn(
                              "p-2 rounded-lg transition-colors",
                              selectedCategory?.id === cat.id ? "bg-white/20" : "bg-zinc-800 group-hover:bg-zinc-700"
                            )}>
                              {cat.icon}
                            </div>
                            <span className="font-medium">{cat.name}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ]}
                </AnimatePresence>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isLoggedIn ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowTopUpModal(true)}
                    className="flex items-center gap-2 bg-zinc-900/80 px-3 py-1.5 rounded-full border border-white/5 whitespace-nowrap hover:bg-zinc-800 transition-colors"
                  >
                    <Wallet size={14} className="text-emerald-500" />
                    <span className="text-sm font-bold">{formatPrice(isRealMode ? user!.balance : demoBalance, language)}</span>
                  </button>
                  {((isRealMode ? user!.balance : demoBalance) < 100) && (
                    <button 
                      onClick={handleRefill}
                      className="bg-emerald-500/10 text-emerald-500 p-1.5 rounded-full hover:bg-emerald-500/20 transition-all"
                      title={isRealMode ? t.refillBalanceTitle : t.refillDemoTitle}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              ) : (
                <Button variant="primary" className="py-1.5 text-xs rounded-full" onClick={() => setShowAuthModal(true)}>{t.login}</Button>
              )}

              {/* Desktop Add Event Button */}
              {isLoggedIn && (
                <button 
                  onClick={() => setCurrentView('create')}
                  className="hidden lg:flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-full font-bold text-sm hover:bg-zinc-200 transition-colors shadow-lg shadow-white/10"
                >
                  <Plus size={18} />
                  <span>{t.createEvent}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex w-full max-w-[1400px] mx-auto relative overflow-hidden pt-16">
        {/* Desktop Sidebar Nav */}
        <aside className="hidden lg:flex flex-col gap-6 w-64 p-6 border-r border-white/5 bg-black/40">
          <div className="space-y-2">
            <SidebarNavButton 
              active={currentView === 'feed'} 
              icon={<TrendingUp size={22} />} 
              label={t.feed} 
              onClick={() => setCurrentView('feed')} 
            />
            <SidebarNavButton 
              active={currentView === 'rank'} 
              icon={<Trophy size={22} />} 
              label={t.rank} 
              onClick={() => setCurrentView('rank')} 
            />
            <SidebarNavButton 
              active={currentView === 'history'} 
              icon={<History size={22} />} 
              label={t.bets} 
              onClick={() => {
                if (!isLoggedIn) setShowAuthModal(true);
                else setCurrentView('history');
              }} 
            />
            <SidebarNavButton 
              active={currentView === 'profile'} 
              icon={<UserIcon size={22} />} 
              label={t.me} 
              onClick={() => {
                if (!isLoggedIn) setShowAuthModal(true);
                else setCurrentView('profile');
              }} 
            />
          </div>

          <div className="mt-auto p-4 rounded-2xl bg-zinc-900/50 border border-white/5">
            <p className="text-xs text-zinc-500 leading-relaxed">
              {t.sidebarTagline}
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 relative overflow-hidden flex justify-center items-center p-4 lg:p-8">
          <div className="w-full max-w-[500px] h-full lg:h-auto lg:aspect-[9/16] lg:max-h-[calc(100vh-120px)] relative bg-zinc-950 shadow-2xl shadow-black rounded-3xl overflow-hidden">
            {renderView()}
          </div>
        </main>
      </div>

      {/* Bottom Nav (Mobile Only) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-t border-white/5 px-6 py-3 flex justify-between items-center">
        <NavButton 
          active={currentView === 'feed'} 
          icon={<TrendingUp size={24} />} 
          label={t.feed} 
          onClick={() => setCurrentView('feed')} 
        />
        <NavButton 
          active={currentView === 'rank'} 
          icon={<Trophy size={24} />} 
          label={t.rank} 
          onClick={() => setCurrentView('rank')} 
        />
        <button 
          onClick={() => {
            if (!isLoggedIn) setShowAuthModal(true);
            else setCurrentView('create');
          }}
          className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-black -mt-8 shadow-xl shadow-white/10 active:scale-90 transition-transform"
        >
          <Plus size={28} />
        </button>
        <NavButton 
          active={currentView === 'history'} 
          icon={<History size={24} />} 
          label={t.bets} 
          onClick={() => {
            if (!isLoggedIn) setShowAuthModal(true);
            else setCurrentView('history');
          }} 
        />
        <NavButton 
          active={currentView === 'profile'} 
          icon={<UserIcon size={24} />} 
          label={t.me} 
          onClick={() => {
            if (!isLoggedIn) setShowAuthModal(true);
            else setCurrentView('profile');
          }} 
        />
      </nav>

      {/* Modals */}
      <AnimatePresence>
        {showBetModal && (
          <div key="bet-modal-container" className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowBetModal(null)}
            />
            <BetModal 
              key="bet-modal"
              market={showBetModal.market} 
              side={showBetModal.side} 
              userBalance={isRealMode ? (user?.balance || 0) : demoBalance}
              onClose={() => setShowBetModal(null)}
              onConfirm={onConfirmBet}
              onRefill={handleRefill}
            />
          </div>
        )}
        {showAuthModal && (
          <div key="auth-modal-container" className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAuthModal(false)}
            />
            <AuthModal key="auth-modal" onClose={() => setShowAuthModal(false)} onLoginSuccess={handleLoginSuccess} />
          </div>
        )}
        {showDetail && (
          <div key="detail-modal-container" className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-0 lg:justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowDetail(null)}
            />
            <MarketDetail 
              key={`detail-${showDetail.id}`}
              market={showDetail} 
              onClose={() => setShowDetail(null)} 
              onBet={handleBetClick}
              onSave={() => handleSave(showDetail.id)}
              onShare={() => handleShare(showDetail)}
              showToast={showToast}
            />
          </div>
        )}
        {showWaitlist && (
          <div key="waitlist-modal-container" className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowWaitlist(false); setIsRealMode(false); }}
            />
            <WaitlistModal key="waitlist-modal" onClose={() => { setShowWaitlist(false); setIsRealMode(false); }} />
          </div>
        )}
        {showWelcomeModal && (
          <div key="welcome-modal-container" className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowWelcomeModal(false)}
            />
            <WelcomeModal 
              onClose={() => setShowWelcomeModal(false)} 
              onTopUp={() => {
                setShowWelcomeModal(false);
                setShowTopUpModal(true);
              }} 
            />
          </div>
        )}
        {showTopUpModal && (
          <div key="topup-modal-container" className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowTopUpModal(false)}
            />
            <WalletModal 
              onClose={() => setShowTopUpModal(false)} 
              showToast={showToast}
              onSuccess={async (amount) => {
                setShowTopUpModal(false);
                setShowDepositSuccess({ amount });
                if (user?.id) {
                  try {
                    const res = await apiFetch(`/api/users/${user.id}`);
                    if (res.ok) {
                      const updatedUser = await res.json();
                      setUser(updatedUser);
                    }
                  } catch {}
                }
              }}
            />
          </div>
        )}
        {confirmBet && (
          <BetConfirmation key="bet-confirm" side={confirmBet.side} amount={confirmBet.amount} />
        )}
        {showDepositSuccess && (
          <DepositSuccessModal key="deposit-success" amount={showDepositSuccess.amount} />
        )}
        {toast && (
          <Toast 
            key="toast"
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
