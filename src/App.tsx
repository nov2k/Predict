import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { 
  TrendingUp, 
  MessageCircle, 
  Heart, 
  Share2, 
  Bookmark, 
  ChevronUp, 
  ChevronDown,
  Wallet,
  User as UserIcon,
  Trophy,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  X,
  Info,
  History,
  ArrowLeft,
  Trash2,
  MoreVertical,
  Search,
  ChevronLeft,
  ChevronRight,
  Cloud,
  FileText,
  Coins,
  Gavel,
  Globe,
  Bitcoin,
  BarChart3,
  Map,
  Music,
  Vote,
  MessageSquare,
  Cpu
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { cn, formatCurrency, formatPrice, trackEvent } from './lib/utils';
import { useAuthStore } from './store/useAuthStore';
import { translations } from './translations';
import confetti from 'canvas-confetti';

// --- Types ---
interface Market {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  videoUrl?: string;
  yesPercent: number;
  noPercent: number;
  totalPool: number;
  bettorsCount: number;
  expiresAt: string;
  userLiked?: boolean;
  userSaved?: boolean;
  priceHistory?: any[];
  _count: {
    bets: number;
    comments: number;
    likes: number;
  };
}

interface MarketProposal {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  videoUrl?: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  user: {
    handle: string;
    avatar: string;
  };
}

// --- Constants ---

const CATEGORIES = [
  { id: 'climate', name: 'Климат и наука', icon: <Cloud size={18} /> },
  { id: 'reporting', name: 'Отчетность', icon: <FileText size={18} /> },
  { id: 'finance', name: 'Финансы', icon: <Coins size={18} /> },
  { id: 'politics', name: 'Политика', icon: <Gavel size={18} /> },
  { id: 'world', name: 'Мир', icon: <Globe size={18} /> },
  { id: 'crypto', name: 'Криптовалюты', icon: <Bitcoin size={18} /> },
  { id: 'economy', name: 'Экономика', icon: <BarChart3 size={18} /> },
  { id: 'geopolitics', name: 'Геополитика', icon: <Map size={18} /> },
  { id: 'sports', name: 'Спорт', icon: <Trophy size={18} /> },
  { id: 'culture', name: 'Культура', icon: <Music size={18} /> },
  { id: 'elections', name: 'Выборы', icon: <Vote size={18} /> },
  { id: 'mentions', name: 'Упоминания', icon: <MessageSquare size={18} /> },
  { id: 'tech', name: 'Технологии', icon: <Cpu size={18} /> },
];

// --- Components ---

const Button = ({ className, variant = 'primary', ...props }: any) => {
  const variants = {
    primary: 'bg-emerald-500 text-white hover:bg-emerald-600',
    secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
    danger: 'bg-rose-500 text-white hover:bg-rose-600',
    outline: 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800',
    ghost: 'text-zinc-400 hover:text-white hover:bg-zinc-800/50',
  };
  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50',
        variants[variant as keyof typeof variants],
        className
      )} 
      {...props} 
    />
  );
};

const GlassCard = ({ children, className }: any) => (
  <div className={cn('bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-4', className)}>
    {children}
  </div>
);

// --- Main App ---

type View = 'feed' | 'rank' | 'create' | 'history' | 'profile' | 'saved' | 'admin';

export default function App() {
  const { user, isLoggedIn, setUser, language, setLanguage, isRealMode, setIsRealMode, demoBalance, setDemoBalance } = useAuthStore();
  const t = translations[language];
  const [markets, setMarkets] = useState<Market[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentView, setCurrentView] = useState<View>('feed');
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBetModal, setShowBetModal] = useState<{ market: Market; side: 'YES' | 'NO' } | null>(null);
  const [showDetail, setShowDetail] = useState<Market | null>(null);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [confirmBet, setConfirmBet] = useState<{ side: 'YES' | 'NO'; amount: number } | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'up' | 'down' | null>(null);
  const [showDepositSuccess, setShowDepositSuccess] = useState<{ amount: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const isSharing = useRef(false);

  useEffect(() => {
    const verifyUser = async () => {
      if (user?.id) {
        try {
          const res = await fetch(`/api/users/${user.id}`);
          if (res.status === 404) {
            console.log("User session invalid (not in DB), logging out...");
            setUser(null);
          } else if (res.ok) {
            const updatedUser = await res.json();
            // Update local user data (like balance) if it changed on server
            setUser(updatedUser);
          }
        } catch (e) {
          console.error("Failed to verify user:", e);
        }
      }
    };
    verifyUser();
  }, []);

  const fetchMarkets = async (category?: string) => {
    try {
      let url = user?.id ? `/api/markets?userId=${user.id}` : '/api/markets';
      if (category) {
        url += (url.includes('?') ? '&' : '?') + `category=${encodeURIComponent(category)}`;
      }
      const res = await fetch(url);
      
      if (user?.id && (res.status === 401 || res.status === 404)) {
        setUser(null);
        return;
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setMarkets(data);
      } else {
        console.error('Markets data is not an array:', data);
        setMarkets([]);
      }
    } catch (e) {
      console.error('Failed to fetch markets:', e);
      setMarkets([]);
    }
  };

  useEffect(() => {
    fetchMarkets(selectedCategory?.name);
    setCurrentIndex(0);
    trackEvent('app_load');
  }, [user?.id, selectedCategory]);

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
      showToast("Demo balance refilled!", 'success');
      return;
    }
    setShowBetModal(null);
    setShowTopUpModal(true);
  };

  const handleBetClick = (market: Market, side: 'YES' | 'NO') => {
    if (!market) return;
    if (!isLoggedIn) {
      setShowAuthModal(true);
      trackEvent('login_wall_shown', undefined, { marketId: market.id });
      return;
    }
    setShowBetModal({ market, side });
    trackEvent('bet_click', user?.id, { marketId: market.id, side });
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
        showToast("Insufficient demo balance", 'error');
        return;
      }
      setDemoBalance(demoBalance - amount);
      setConfirmBet({ side, amount });
      setShowBetModal(null);
      showToast("Demo bet placed successfully!", 'success');
      return;
    }

    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
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
        } else {
          showToast(errorMsg, 'error');
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (data.bet) {
        setUser({ ...user!, balance: data.balance });
        setConfirmBet({ side, amount });
        trackEvent('bet_success', user?.id, { marketId: market.id, amount, side });
        
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

  const handleLogin = async (email: string) => {
    if (!email || !email.includes('@')) {
      showToast("Please enter a valid email", 'error');
      return;
    }
    try {
      const handle = email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);
      const res = await fetch('/api/auth/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, handle })
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        if (text.includes("Starting Server...")) {
          showToast("Server is still starting. Please wait a few seconds and try again.", 'info');
        } else {
          console.error("Server returned non-JSON:", text);
          showToast("Server error. Please try again later.", 'error');
        }
        return;
      }

      if (!res.ok) {
        showToast(data.error || 'Login failed', 'error');
        return;
      }

      setUser(data);
      setIsRealMode(true);
      setShowAuthModal(false);
      trackEvent('login_success', data.id);

      if (data.isNewUser) {
        setShowWelcomeModal(true);
      }
    } catch (error) {
      console.error("Login error:", error);
      showToast("Connection error. Please try again.", 'error');
    }
  };

  const handleSwipe = (direction: 'up' | 'down') => {
    if (isSwiping) return;

    if (direction === 'up') {
      if (currentIndex < markets.length - 1) {
        setIsSwiping(true);
        setSwipeDirection('up');
        setCurrentIndex(prev => prev + 1);
        trackEvent('swipe_up', user?.id, { index: currentIndex + 1 });
        setTimeout(() => {
          setIsSwiping(false);
          setSwipeDirection(null);
        }, 500);
      } else {
        // Bounce at end
        setSwipeDirection('up');
        setIsSwiping(true);
        setTimeout(() => {
          setIsSwiping(false);
          setSwipeDirection(null);
        }, 300);
      }
    } else if (direction === 'down') {
      if (currentIndex > 0) {
        setIsSwiping(true);
        setSwipeDirection('down');
        setCurrentIndex(prev => prev - 1);
        trackEvent('swipe_down', user?.id, { index: currentIndex - 1 });
        setTimeout(() => {
          setIsSwiping(false);
          setSwipeDirection(null);
        }, 500);
      } else {
        // Bounce at top
        setSwipeDirection('down');
        setIsSwiping(true);
        setTimeout(() => {
          setIsSwiping(false);
          setSwipeDirection(null);
        }, 300);
      }
    }
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
      const res = await fetch(`/api/markets/${marketId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
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
      const res = await fetch(`/api/markets/${marketId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
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
      text: `Check out this prediction market: ${market.title}`,
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
          <h3 className="text-xl font-bold mb-2">Loading Markets...</h3>
          <p className="text-zinc-500 text-sm">Getting the latest predictions for you</p>
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
              <h3 className="text-xl font-bold mb-2">End of Feed</h3>
              <p className="text-zinc-500 text-sm">You've seen all the latest markets!</p>
              <Button variant="primary" className="mt-6" onClick={() => setCurrentIndex(0)}>Back to Top</Button>
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
        return <AdminView onBack={() => setCurrentView('profile')} onRefreshMarkets={fetchMarkets} showToast={showToast} />;
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
              <span className="font-black text-xl lg:text-2xl tracking-tighter text-emerald-500 italic">Casi</span>
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
                  <span>{selectedCategory ? (selectedCategory.name.length > 5 ? selectedCategory.name.slice(0, 5) + '..' : selectedCategory.name) : 'Категории'}</span>
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
                        {CATEGORIES.map((cat) => (
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
                      title={isRealMode ? "Refill Balance" : "Refill Demo Balance"}
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
                  <span>Разместить событие</span>
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
              Предсказывайте события и зарабатывайте на своих знаниях.
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
            <AuthModal key="auth-modal" onClose={() => setShowAuthModal(false)} onLogin={handleLogin} />
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
              onSuccess={(amount) => {
                setShowTopUpModal(false);
                setShowDepositSuccess({ amount });
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

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-colors",
        active ? "text-emerald-500" : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-widest">{label}</span>
    </button>
  );
}

function SidebarNavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
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

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
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

// --- Views ---

function RankingView() {
  const { language } = useAuthStore();
  const t = translations[language];
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users/rankings')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRankings(data);
        } else {
          setRankings([]);
        }
        setLoading(false);
      })
      .catch(() => {
        setRankings([]);
        setLoading(false);
      });
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full pt-6 pb-24 overflow-y-auto no-scrollbar px-6"
    >
      <h2 className="text-3xl font-black mb-6 tracking-tighter">{t.leaderboard}</h2>
      
      {loading ? (
        <div key="ranking-loading" className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div key="ranking-list" className="space-y-3">
          {rankings?.map((u, i) => (
            <GlassCard key={`rank-${u.id || i}-${i}`} className="flex items-center gap-4 py-3">
              <span className={cn(
                "w-6 text-center font-black italic text-lg",
                i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-400" : i === 2 ? "text-amber-600" : "text-zinc-600"
              )}>
                {i + 1}
              </span>
              <img src={u.avatar} className="w-10 h-10 rounded-xl bg-zinc-800" />
              <div className="flex-1">
                <div className="font-bold">@{u.handle}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest">{u._count.bets} {t.bets}</div>
              </div>
              <div className="text-right">
                <div className="font-black text-emerald-400">{formatPrice(u.totalWinnings || 0, language)}</div>
                <div className="text-[10px] text-zinc-600 uppercase tracking-widest">{t.totalWon}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function HistoryView({ userId }: { userId?: string }) {
  const { language } = useAuthStore();
  const t = translations[language];
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetch(`/api/users/${userId}/bets`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setBets(data);
          } else {
            setBets([]);
          }
          setLoading(false);
        })
        .catch(() => {
          setBets([]);
          setLoading(false);
        });
    }
  }, [userId]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full pt-6 pb-24 overflow-y-auto no-scrollbar px-6"
    >
      <h2 className="text-3xl font-black mb-6 tracking-tighter">{t.myBets}</h2>
      
      {loading ? (
        <div key="history-loading" className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : bets.length === 0 ? (
        <div key="no-history" className="text-center py-12 text-zinc-500">{t.noBets}</div>
      ) : (
        <div key="history-list" className="space-y-4">
          {bets?.map((b, i) => (
            <GlassCard key={`bet-hist-${b.id || i}-${i}`} className="flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                  b.side === 'YES' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                )}>
                  {b.side}
                </span>
                <span className="text-[10px] text-zinc-600">{new Date(b.createdAt).toLocaleDateString()}</span>
              </div>
              <h4 className="font-bold text-sm leading-tight">{b.market.title}</h4>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <span className="text-xs text-zinc-500">{t.amount}</span>
                <span className="font-bold">{formatPrice(b.amount, language)}</span>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ProfileView({ user, onLogout, onSavedClick, onAdminClick, onTopUp }: { user: any; onLogout: () => void; onSavedClick: () => void; onAdminClick: () => void; onTopUp: () => void }) {
  const { language, setLanguage, isRealMode, setIsRealMode, demoBalance } = useAuthStore();
  const t = translations[language];

  // Stable pseudo-random win rate based on user ID
  const getWinRate = () => {
    if (!user?.id) return 74;
    let hash = 0;
    for (let i = 0; i < user.id.length; i++) {
      hash = ((hash << 5) - hash) + user.id.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 30) + 60;
  };

  const winRate = getWinRate();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full pt-6 pb-24 overflow-y-auto no-scrollbar px-6"
    >
      <div className="flex flex-col items-center mb-8">
        <div className="relative mb-4">
          <img src={user.avatar} className="w-24 h-24 rounded-[2rem] bg-zinc-800 border-2 border-emerald-500/20" />
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-black p-1.5 rounded-xl shadow-lg">
            <CheckCircle2 size={16} />
          </div>
        </div>
        <h2 className="text-2xl font-black tracking-tight">@{user.handle}</h2>
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">{user.role === 'ADMIN' ? 'Admin' : 'User'}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <GlassCard 
          onClick={onTopUp}
          className="flex flex-col items-center py-6 relative overflow-hidden group cursor-pointer hover:bg-white/5 transition-colors"
        >
          <span className="text-3xl font-black text-emerald-400 whitespace-nowrap">{formatPrice(isRealMode ? user.balance : demoBalance, language)}</span>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{t.credits}</span>
          <div className="absolute inset-x-0 bottom-0 bg-emerald-500 text-black text-[10px] font-black py-1 uppercase tracking-tighter translate-y-full group-hover:translate-y-0 transition-transform text-center">
            {t.topUp}
          </div>
        </GlassCard>
        <GlassCard className="flex flex-col items-center py-6">
          <span className="text-3xl font-black whitespace-nowrap">{winRate}%</span>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{t.winRate}</span>
        </GlassCard>
      </div>

      <div className="space-y-3">
        <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"><TrendingUp size={20} /></div>
            <span className="font-bold">{t.demo} / {t.live}</span>
          </div>
          <div className="flex bg-zinc-800 rounded-lg p-1">
            <button 
              onClick={() => setIsRealMode(false)}
              className={cn("px-3 py-1 rounded-md text-xs font-bold transition-all", !isRealMode ? "bg-emerald-500 text-black" : "text-zinc-500")}
            >
              {t.demo}
            </button>
            <button 
              onClick={() => {
                setIsRealMode(true);
              }}
              className={cn("px-3 py-1 rounded-md text-xs font-bold transition-all", isRealMode ? "bg-emerald-500 text-black" : "text-zinc-500")}
            >
              {t.live}
            </button>
          </div>
        </div>
        <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"><Info size={20} /></div>
            <span className="font-bold">{t.language}</span>
          </div>
          <div className="flex bg-zinc-800 rounded-lg p-1">
            <button 
              onClick={() => setLanguage('en')}
              className={cn("px-3 py-1 rounded-md text-xs font-bold transition-all", language === 'en' ? "bg-emerald-500 text-black" : "text-zinc-500")}
            >
              EN
            </button>
            <button 
              onClick={() => setLanguage('ru')}
              className={cn("px-3 py-1 rounded-md text-xs font-bold transition-all", language === 'ru' ? "bg-emerald-500 text-black" : "text-zinc-500")}
            >
              RU
            </button>
          </div>
        </div>
        <button className="w-full bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between hover:bg-zinc-800/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"><TrendingUp size={20} /></div>
            <span className="font-bold">{t.statistics}</span>
          </div>
          <ArrowUpRight size={20} className="text-zinc-600" />
        </button>
        <button 
          onClick={onSavedClick}
          className="w-full bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"><Heart size={20} /></div>
            <span className="font-bold">{t.saved}</span>
          </div>
          <ArrowUpRight size={20} className="text-zinc-600" />
        </button>
        <button 
          onClick={onAdminClick}
          className="w-full bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400"><Trophy size={20} /></div>
            <span className="font-bold">{t.admin}</span>
          </div>
          <ArrowUpRight size={20} className="text-zinc-600" />
        </button>
        <button 
          onClick={onLogout}
          className="w-full bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center justify-center gap-3 text-rose-500 font-bold mt-8"
        >
          {t.logout}
        </button>
      </div>
    </motion.div>
  );
}

function SavedView({ userId, onBack, onMarketClick }: { userId: string | undefined; onBack: () => void; onMarketClick: (m: Market) => void }) {
  const { language } = useAuthStore();
  const t = translations[language];
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetch(`/api/users/${userId}/saves`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setMarkets(data);
          } else {
            setMarkets([]);
          }
          setLoading(false);
        })
        .catch(() => {
          setMarkets([]);
          setLoading(false);
        });
    }
  }, [userId]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full pt-6 pb-24 overflow-y-auto no-scrollbar px-6"
    >
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-zinc-900 rounded-full"><ArrowLeft size={24} /></button>
        <h2 className="text-3xl font-black tracking-tighter">{t.saved}</h2>
      </div>
      
      {loading ? (
        <div key="saved-loading" className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : markets.length === 0 ? (
        <div key="no-saved" className="text-center py-12 text-zinc-500">No saved markets yet</div>
      ) : (
        <div key="saved-list" className="space-y-4">
          {markets?.map((m, i) => (
            <GlassCard key={`saved-market-${m.id || i}-${i}`} className="flex gap-4 items-center" onClick={() => onMarketClick(m)}>
              <img src={m.imageUrl} className="w-16 h-16 rounded-xl object-cover" />
              <div className="flex-1">
                <h4 className="font-bold text-sm leading-tight mb-1">{m.title}</h4>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">{m.category}</span>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold">
                    <Heart size={10} className="text-rose-500" fill="currentColor" /> {m._count.likes}
                  </div>
                </div>
              </div>
              <ArrowUpRight size={20} className="text-zinc-600" />
            </GlassCard>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function CreateView({ onClose, showToast }: { onClose: () => void; showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const { user, language } = useAuthStore();
  const t = translations[language];
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Crypto');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        showToast("Video size too large. Max 50MB.", 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setVideoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!title || !description || !user || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          videoUrl,
          userId: user.id
        })
      });

      if (!res.ok) {
        let errorMsg = 'Failed to submit proposal';
        try {
          const clone = res.clone();
          const errorData = await clone.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          const text = await res.text();
          console.error("Server returned non-JSON error:", text);
          errorMsg = `Server error: ${res.status}`;
        }

        if (res.status === 401 || (errorMsg && errorMsg.includes("User not found"))) {
          useAuthStore.getState().logout();
          window.location.reload(); // Force reload to clear state
          return;
        }
        throw new Error(errorMsg);
      }

      onClose();
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full w-full pt-6 pb-24 overflow-y-auto no-scrollbar px-6"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-black tracking-tighter">{t.propose}</h2>
        <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-full"><X size={24} /></button>
      </div>

      <GlassCard className="p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t.question}</label>
          <textarea 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Will Bitcoin hit $100k?" 
            className="w-full bg-zinc-800/50 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-emerald-500 h-20 resize-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t.description}</label>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide context for this market..." 
            className="w-full bg-zinc-800/50 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-emerald-500 h-24 resize-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t.category}</label>
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-zinc-800/50 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-emerald-500 appearance-none"
          >
            <option>Crypto</option>
            <option>Sports</option>
            <option>Politics</option>
            <option>Tech</option>
            <option>Science</option>
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t.uploadVideo}</label>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-[9/16] max-h-[400px] bg-zinc-800/50 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-800/80 transition-colors overflow-hidden relative mx-auto group"
          >
            {videoUrl ? (
              <video src={videoUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 group-hover:text-emerald-500 transition-colors">
                  <Plus size={32} />
                </div>
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Выбрать видео</span>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleVideoUpload} 
              className="hidden" 
              accept="video/*"
            />
          </div>
        </div>

        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 space-y-3">
          <div className="flex items-center gap-2 text-zinc-400">
            <Info size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Требования TikTok</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">Формат</p>
              <p className="text-xs font-medium">MP4, MOV</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">Размер</p>
              <p className="text-xs font-medium">До 50 МБ</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">Разрешение</p>
              <p className="text-xs font-medium">720x1280+</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">Ориентация</p>
              <p className="text-xs font-medium">Вертикальная</p>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button 
            className="w-full py-4 rounded-2xl font-bold" 
            onClick={handleSubmit}
            disabled={loading || !title || !description}
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : t.submit}
          </Button>
          <p className="text-center text-[10px] text-zinc-600 mt-4 uppercase tracking-widest">{t.reviewNote}</p>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function AdminView({ onBack, onRefreshMarkets, showToast }: { onBack: () => void; onRefreshMarkets?: () => void; showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const { language } = useAuthStore();
  const t = translations[language];
  const [proposals, setProposals] = useState<MarketProposal[]>([]);
  const [activeMarkets, setActiveMarkets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminTab, setAdminTab] = useState<'proposals' | 'markets' | 'users'>('proposals');
  
  // User search/pagination
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [showUserMenu, setShowUserMenu] = useState<string | null>(null);
  const [grantBalanceUser, setGrantBalanceUser] = useState<any | null>(null);
  const [grantWinningsUser, setGrantWinningsUser] = useState<any | null>(null);
  const [grantAmount, setGrantAmount] = useState<string>('1000');

  const fetchData = async () => {
    setLoading(true);
    try {
      if (adminTab === 'users') {
        const res = await fetch(`/api/admin/users?search=${userSearch}&page=${userPage}`);
        const data = await res.json();
        setUsers(data.users || []);
        setUserTotalPages(data.pages || 1);
      } else {
        const [pRes, mRes] = await Promise.all([
          fetch('/api/proposals'),
          fetch('/api/markets')
        ]);
        const pData = await pRes.json();
        const mData = await mRes.json();
        setProposals(Array.isArray(pData) ? pData : []);
        setActiveMarkets(Array.isArray(mData) ? mData : []);
      }
    } catch (e) {
      setProposals([]);
      setActiveMarkets([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [adminTab, userPage]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (adminTab === 'users') {
        setUserPage(1);
        fetchData();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'delete' | 'deleteMarket') => {
    try {
      if (action === 'delete') {
        await fetch(`/api/proposals/${id}`, { method: 'DELETE' });
      } else if (action === 'deleteMarket') {
        await fetch(`/api/markets/${id}`, { method: 'DELETE' });
        if (onRefreshMarkets) onRefreshMarkets();
      } else {
        await fetch(`/api/proposals/${id}/${action}`, { method: 'POST' });
        if (action === 'approve' && onRefreshMarkets) onRefreshMarkets();
      }
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

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

      <div className="flex gap-2 mb-6 p-1 bg-zinc-900/50 rounded-xl border border-white/5">
        <button 
          onClick={() => setAdminTab('proposals')}
          className={cn(
            "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
            adminTab === 'proposals' ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
          )}
        >
          Proposals
        </button>
        <button 
          onClick={() => setAdminTab('markets')}
          className={cn(
            "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
            adminTab === 'markets' ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
          )}
        >
          Markets
        </button>
        <button 
          onClick={() => setAdminTab('users')}
          className={cn(
            "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
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
                      <div className="text-[10px] text-zinc-500">{new Date(p.createdAt).toLocaleDateString()}</div>
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
                    <video src={p.videoUrl} className="w-full h-full object-cover" controls muted />
                  </div>
                ) : p.imageUrl && (
                  <img src={p.imageUrl} className="w-full h-full object-cover rounded-xl border border-white/5" />
                )}

                {p.status === 'PENDING' && (
                  <div className="flex gap-3 pt-2">
                    <Button variant="primary" className="flex-1 py-3" onClick={() => handleAction(p.id, 'approve')}>{t.approve}</Button>
                    <Button variant="danger" className="flex-1 py-3" onClick={() => handleAction(p.id, 'reject')}>{t.reject}</Button>
                  </div>
                )}

                {p.status !== 'PENDING' && (
                  <Button variant="outline" className="w-full py-2 text-xs opacity-50 hover:opacity-100" onClick={() => handleAction(p.id, 'delete')}>
                    <Trash2 size={12} className="mr-2" /> Delete Record
                  </Button>
                )}
              </GlassCard>
            ))}
          </div>
        )
      ) : adminTab === 'markets' ? (
        activeMarkets.length === 0 ? (
          <div key="no-active-markets" className="text-center py-12 text-zinc-500">No active markets</div>
        ) : (
          <div key="active-markets-list" className="space-y-6">
            {activeMarkets?.map((m, i) => (
              <GlassCard key={`admin-market-${m.id || i}-${i}`} className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest bg-emerald-500/20 text-emerald-500">
                    Active Market
                  </div>
                  <div className="text-[10px] text-zinc-500">{new Date(m.createdAt).toLocaleDateString()}</div>
                </div>

                <div>
                  <h3 className="font-bold text-lg leading-tight mb-2">{m.title}</h3>
                  <p className="text-sm text-zinc-400">{m.description}</p>
                </div>

                {m.videoUrl ? (
                  <div className="w-full aspect-[9/16] max-h-[300px] rounded-xl overflow-hidden border border-white/5 mx-auto">
                    <video src={m.videoUrl} className="w-full h-full object-cover" controls muted />
                  </div>
                ) : m.imageUrl && (
                  <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/5">
                    <img src={m.imageUrl} className="w-full h-full object-cover" />
                  </div>
                )}

                <Button variant="danger" className="w-full py-3" onClick={() => handleAction(m.id, 'deleteMarket')}>
                  <Trash2 size={16} className="mr-2" /> Delete Market from Feed
                </Button>
              </GlassCard>
            ))}
          </div>
        )
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
                    <span className="opacity-60">Win Rate: {(() => {
                      let hash = 0;
                      for (let i = 0; i < u.id.length; i++) {
                        hash = ((hash << 5) - hash) + u.id.charCodeAt(i);
                        hash |= 0;
                      }
                      return Math.abs(hash % 30) + 60;
                    })()}%</span>
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
                        await fetch(`/api/admin/users/${u.id}/role`, {
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
                      const res = await fetch(`/api/admin/users/${grantBalanceUser.id}/balance`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount })
                      });
                      if (res.ok) {
                        fetchData();
                        setGrantBalanceUser(null);
                        showToast("Balance updated", 'success');
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
                      const res = await fetch(`/api/admin/users/${grantWinningsUser.id}/winnings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount })
                      });
                      if (res.ok) {
                        showToast(t.confirm, 'success');
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


// --- Sub-components ---

function MarketCard({ market, direction, onDetail, onSwipe, onLike, onSave, onShare, isFirst, isLast }: { 
  market: Market; 
  direction: 'up' | 'down' | null;
  onDetail: () => void;
  onSwipe: (d: 'up' | 'down') => void;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const touchStart = useRef(0);
  const { user, isLoggedIn, language } = useAuthStore();
  const t = translations[language];

  const variants = {
    initial: (direction: string | null) => ({
      y: direction === 'up' ? '100%' : direction === 'down' ? '-100%' : 0,
      opacity: direction ? 0 : 1,
      scale: direction ? 0.9 : 1
    }),
    animate: {
      y: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: string | null) => ({
      y: direction === 'up' ? '-100%' : direction === 'down' ? '100%' : 0,
      opacity: 0,
      scale: 0.9
    }),
    bounceUp: {
      y: [0, -30, 0],
      transition: { duration: 0.4 }
    },
    bounceDown: {
      y: [0, 30, 0],
      transition: { duration: 0.4 }
    }
  };

  const isAtLimit = (direction === 'up' && isLast) || (direction === 'down' && isFirst);

  return (
    <motion.div 
      custom={direction}
      variants={variants}
      initial="initial"
      animate={isAtLimit ? (direction === 'up' ? "bounceUp" : "bounceDown") : "animate"}
      exit="exit"
      transition={{ type: 'spring', damping: 30, stiffness: 200 }}
      className="absolute inset-0 w-full h-full bg-black"
      onWheel={e => {
        if (Math.abs(e.deltaY) > 30) {
          onSwipe(e.deltaY > 0 ? 'up' : 'down');
        }
      }}
      onTouchStart={e => touchStart.current = e.touches[0].clientY}
      onTouchEnd={e => {
        const delta = touchStart.current - e.changedTouches[0].clientY;
        if (Math.abs(delta) > 50) {
          onSwipe(delta > 0 ? 'up' : 'down');
        }
      }}
    >
      {/* Background Media */}
      <div className="absolute inset-0 bg-zinc-950">
        {market.videoUrl ? (
          <video 
            src={market.videoUrl} 
            className="w-full h-full object-cover opacity-60" 
            autoPlay 
            loop 
            muted 
            playsInline 
          />
        ) : (
          <img 
            src={market.imageUrl} 
            className="w-full h-full object-cover opacity-40" 
            alt=""
            referrerPolicy="no-referrer"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-zinc-900/40 to-black/60" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end p-4 pr-18 pb-28 lg:pb-12 sm:pr-6">
        <div className="flex flex-col gap-2 max-w-lg">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-emerald-500/30">
              {market.category}
            </span>
            <span className="bg-zinc-800/80 text-zinc-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-white/5 flex items-center gap-1">
              <TrendingUp size={10} />
              Trending
            </span>
          </div>

          <h1 className="text-2xl font-bold leading-tight tracking-tight" onClick={onDetail}>
            {market.title}
          </h1>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <GlassCard className="flex items-center gap-2 p-2 px-3">
              <Wallet size={14} className="text-zinc-500" />
              <span className="text-sm font-bold">{formatPrice(market.totalPool, language)}</span>
            </GlassCard>
            <GlassCard className="flex items-center gap-2 p-2 px-3">
              <UserIcon size={14} className="text-zinc-500" />
              <span className="text-sm font-bold">{market.bettorsCount}</span>
            </GlassCard>
          </div>

          <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={(e) => { e.stopPropagation(); onDetail(); }}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black py-2 rounded-xl flex items-center justify-center transition-all active:scale-95"
            >
              <span className="text-base">YES {market.yesPercent.toFixed(0)}%</span>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDetail(); }}
              className="flex-1 bg-rose-500 hover:bg-rose-400 text-white font-black py-2 rounded-xl flex items-center justify-center transition-all active:scale-95"
            >
              <span className="text-base">NO {market.noPercent.toFixed(0)}%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Rail */}
      <div className="absolute right-4 bottom-28 flex flex-col gap-4 items-center">
        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            className={cn(
              "w-11 h-11 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-90 transition-all",
              market.userLiked ? "bg-rose-500 text-white border-rose-500" : "bg-zinc-900/60 text-white"
            )}
          >
            <Heart size={22} fill={market.userLiked ? "currentColor" : "none"} />
          </button>
          <span className="text-[10px] font-bold">{market._count.likes}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button onClick={onDetail} className="w-11 h-11 rounded-full bg-zinc-900/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform">
            <MessageCircle size={22} />
          </button>
          <span className="text-[10px] font-bold">{market._count.comments}</span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          className={cn(
            "w-11 h-11 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-90 transition-all",
            market.userSaved ? "bg-emerald-500 text-black border-emerald-500" : "bg-zinc-900/60 text-white"
          )}
        >
          <Bookmark size={22} fill={market.userSaved ? "currentColor" : "none"} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onShare(); }}
          className="w-11 h-11 rounded-full bg-zinc-900/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          <Share2 size={22} />
        </button>
      </div>
    </motion.div>
  );
}

function BetModal({ market, side, userBalance, onClose, onConfirm, onRefill }: { 
  market: Market; 
  side: 'YES' | 'NO'; 
  userBalance: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  onRefill?: () => void;
}) {
  const { language, isRealMode } = useAuthStore();
  const t = translations[language];
  const [amount, setAmount] = useState<number>(100);
  const chips = [50, 100, 250, 500, 1000];

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="bg-zinc-900 w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl relative z-[110]"
      onClick={e => e.stopPropagation()}
    >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{t.predict}</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full"><X size={20} /></button>
        </div>

        <div className="mb-6">
          <p className="text-zinc-400 text-sm mb-2">{t.predict} <span className={cn("font-bold", side === 'YES' ? "text-emerald-500" : "text-rose-500")}>{side}</span> {t.on}:</p>
          <h3 className="font-bold leading-tight">{market.title}</h3>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-end mb-4">
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{t.amount}</span>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 mb-1">
                <button 
                  onClick={() => setAmount(userBalance)}
                  className="text-[10px] font-bold bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md hover:bg-zinc-700 transition-colors"
                >
                  MAX
                </button>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                  className="bg-transparent text-right text-2xl font-bold focus:outline-none w-24 border-b border-white/10"
                />
              </div>
              <span className="text-zinc-500 text-xs">Balance: {formatPrice(userBalance, language, !isRealMode)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {chips?.map((c, i) => (
              <button 
                key={`chip-${c}-${i}`}
                onClick={() => setAmount(c)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold border transition-all",
                  amount === c ? "bg-emerald-500 border-emerald-500 text-black" : "bg-zinc-800 border-white/5 text-zinc-400"
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-zinc-400 text-sm">{t.potentialPayout}</span>
              <span className="font-bold text-emerald-500">
                {formatPrice(amount / (Math.max(1, side === 'YES' ? market.yesPercent : market.noPercent) / 100), language, !isRealMode)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">{t.potentialProfit}</span>
              <span className="font-bold text-emerald-400">
                +{formatPrice((amount / (Math.max(1, side === 'YES' ? market.yesPercent : market.noPercent) / 100)) - amount, language, !isRealMode)}
              </span>
            </div>
          </div>
        </div>

        <Button 
          variant={side === 'YES' ? 'primary' : 'danger'} 
          className="w-full py-4 rounded-2xl text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => {
            if (amount > userBalance) {
              onRefill?.();
            } else {
              onConfirm(amount);
            }
          }}
          disabled={amount <= 0}
        >
          {amount > userBalance ? `${t.topUp} & ${t.predict} ${side}` : `${t.predict} ${side}`}
        </Button>
      </motion.div>
  );
}

function AuthModal({ onClose, onLogin }: { onClose: () => void; onLogin: (email: string) => void }) {
  const { language } = useAuthStore();
  const t = translations[language];
  const [email, setEmail] = useState('');

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-zinc-900 w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 text-center shadow-2xl relative z-[110]"
      onClick={e => e.stopPropagation()}
    >
        <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-500">
          <TrendingUp size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-3">{t.joinMarket}</h2>
        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
          {t.authNote}
        </p>
        <div className="flex flex-col gap-3">
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors mb-2"
          />
          <Button className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3" onClick={() => onLogin(email)}>
            {t.login}
          </Button>
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-zinc-900 px-2 text-zinc-500">or</span></div>
          </div>
          <button 
            onClick={() => onLogin('google_user@gmail.com')}
            className="w-full bg-white text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-200 transition-colors"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" className="mr-2">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
          <button onClick={onClose} className="text-zinc-500 text-sm font-medium mt-4 hover:text-zinc-300">{t.maybeLater}</button>
        </div>
    </motion.div>
  );
}

function MarketDetail({ market: initialMarket, onClose, onBet, onSave, onShare, showToast }: { market: Market; onClose: () => void; onBet: (m: Market, s: 'YES' | 'NO') => void; onSave: () => void; onShare: () => void; showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const { user, isLoggedIn, language } = useAuthStore();
  const t = translations[language];
  const [market, setMarket] = useState<any>(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!initialMarket?.id) return;
      try {
        const url = user?.id ? `/api/markets/${initialMarket.id}?userId=${user.id}` : `/api/markets/${initialMarket.id}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && !data.error) {
          setMarket((prev: any) => {
            if (!prev) return data;
            // Merge fetched data with current state to preserve any optimistic updates
            return { ...prev, ...data, comments: data.comments || prev?.comments || [] };
          });
        } else {
          onClose();
        }
      } catch (e) {
        onClose();
      }
    };
    
    // Optimistically update from props if they change (e.g. after a bet)
    if (initialMarket) {
      setMarket((prev: any) => {
        if (!prev) return initialMarket;
        return { ...prev, ...initialMarket };
      });
    }
    
    fetchDetail();
  }, [initialMarket.id, initialMarket.yesPercent, initialMarket.noPercent, user?.id]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn || !commentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/markets/${market.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, content: commentText })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || (data.error && data.error.includes("User not found"))) {
          useAuthStore.getState().logout();
          window.location.reload();
          return;
        }
        throw new Error(data.error || 'Failed to post comment');
      }

      const newComment = data;
      setMarket((prev: any) => ({
        ...prev,
        ...data,
        comments: [newComment, ...(prev.comments || [])],
        _count: { ...prev._count, comments: prev._count.comments + 1 }
      }));
      setCommentText('');
    } catch (e) {
      console.error(e);
      showToast(e instanceof Error ? e.message : 'Failed to post comment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!market) return (
    <div className="w-full h-full bg-zinc-950 flex items-center justify-center rounded-3xl">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const chartData = market.priceHistory && market.priceHistory.length > 0 
    ? market.priceHistory?.map((p: any) => ({ time: new Date(p.createdAt).toLocaleDateString(), value: p.value }))
    : [
        { time: 'Jan', value: 45 },
        { time: 'Feb', value: 52 },
        { time: 'Mar', value: 48 },
        { time: 'Apr', value: 61 },
        { time: 'May', value: 55 },
        { time: 'Jun', value: 67 },
      ];

  return (
    <motion.div 
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="bg-zinc-950 w-full h-full max-h-[90vh] lg:max-w-md lg:h-full lg:max-h-full flex flex-col rounded-t-3xl lg:rounded-none overflow-hidden shadow-2xl relative z-[110]"
      onClick={e => e.stopPropagation()}
    >
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-full"><ArrowLeft size={24} /></button>
        <span className="font-bold text-sm uppercase tracking-widest truncate max-w-[200px]">{market.title}</span>
        <div className="flex items-center gap-1">
          <button 
            onClick={onSave} 
            className={cn("p-2 rounded-full transition-colors", market.userSaved ? "text-emerald-500" : "text-zinc-400 hover:bg-zinc-900")}
          >
            <Bookmark size={20} fill={market.userSaved ? "currentColor" : "none"} />
          </button>
          <button onClick={onShare} className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400"><Share2 size={20} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-12 no-scrollbar">
        {/* Chart Section - Now inside scrollable area */}
        <div className="bg-zinc-950 border-b border-white/5">
          <div className="w-full h-64 bg-zinc-900/30 relative overflow-hidden touch-pan-y">
            <div className="absolute inset-0 z-10 w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} strokeOpacity={0.1} />
                  <XAxis 
                    dataKey="time" 
                    hide 
                    padding={{ left: 0, right: 0 }}
                  />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    hide 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                    itemStyle={{ color: '#10b981' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="px-6 py-4 flex gap-2">
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
              {market.category}
            </span>
          </div>
        </div>

        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6 leading-tight">{market.title}</h1>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <GlassCard className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">All-time High</span>
            <span className="text-lg font-bold">{Math.max(market.yesPercent, market.noPercent, 75).toFixed(0)}%</span>
          </GlassCard>
          <GlassCard className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Volatility</span>
            <span className={cn("text-lg font-bold", market.totalPool > 1000000 ? "text-rose-500" : "text-emerald-500")}>
              {market.totalPool > 1000000 ? "High" : "Stable"}
            </span>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
              <Info size={14} /> {t.description}
            </h3>
            <p className="text-zinc-400 leading-relaxed text-sm">
              {market.description}
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
              <MessageCircle size={14} /> {t.comments} ({market._count.comments})
            </h3>
            
            {isLoggedIn && (
              <form onSubmit={handlePostComment} className="mb-6 flex gap-2">
                <input 
                  type="text" 
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
                <Button type="submit" disabled={!commentText.trim() || isSubmitting} className="py-2 px-4">
                  Post
                </Button>
              </form>
            )}

            <div className="space-y-4">
              {market.comments?.map((c: any, i: number) => (
                <div key={`comment-${c.id || i}-${i}`} className="flex gap-3">
                  <img src={c.user.avatar} className="w-8 h-8 rounded-full bg-zinc-800" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold">@{c.user.handle}</span>
                      <span className="text-[10px] text-zinc-600">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-zinc-400">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>

    <div className="p-6 border-t border-white/5 bg-zinc-950 flex gap-4">
        <Button 
          variant="primary" 
          className="flex-1 py-4 rounded-2xl font-bold text-black"
          onClick={() => onBet(market, 'YES')}
        >
          YES {market.yesPercent.toFixed(0)}%
        </Button>
        <Button 
          variant="danger" 
          className="flex-1 py-4 rounded-2xl font-bold"
          onClick={() => onBet(market, 'NO')}
        >
          NO {market.noPercent.toFixed(0)}%
        </Button>
      </div>
    </motion.div>
  );
}

function WaitlistModal({ onClose }: { onClose: () => void }) {
  const { language } = useAuthStore();
  const t = translations[language];
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, intendedAmount: 100 })
    });
    setSubmitted(true);
    trackEvent('waitlist_submission', undefined, { email });
  };

  return (
    <motion.div 
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
            <h2 className="text-2xl font-bold mb-3">{t.comingSoon}</h2>
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

function BetConfirmation({ side, amount }: { side: 'YES' | 'NO'; amount: number }) {
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

function WelcomeModal({ onClose, onTopUp }: { onClose: () => void; onTopUp: () => void }) {
  const { language } = useAuthStore();
  const t = translations[language];

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      className="bg-zinc-900 w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 text-center shadow-2xl relative z-[310]"
      onClick={e => e.stopPropagation()}
    >
      <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-500">
        <Wallet size={40} />
      </div>
      <h2 className="text-2xl font-bold mb-3">{t.welcomeTitle}</h2>
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

function WalletModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (amount: number) => void }) {
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
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount: numAmount })
      });
      const data = await res.json();
      if (data.payment_url) {
        // Use window.top.open or just window.open
        // In some iframe environments, window.open might be restricted
        const win = window.open(data.payment_url, '_blank');
        if (!win) {
          // Fallback if popup blocked
          window.location.href = data.payment_url;
        }
        
        if (data.mock) {
          setTimeout(async () => {
            onSuccess(numAmount);
          }, 3000);
        }
      } else {
        console.error("No payment URL returned", data);
      }
    } catch (error) {
      console.error("Payment error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      className="bg-zinc-900 w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 shadow-2xl relative z-[310]"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">{t.wallet}</h2>
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
        <div className="py-12 flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500">
            <Info size={32} />
          </div>
          <p className="text-zinc-400 text-sm font-medium px-4">
            {t.withdrawUnavailable}
          </p>
          <Button 
            variant="secondary" 
            className="w-full mt-4 py-4 rounded-2xl font-bold opacity-50 cursor-not-allowed" 
            disabled
          >
            {t.withdraw}
          </Button>
        </div>
      )}
    </motion.div>
  );
}

function DepositSuccessModal({ amount }: { amount: number }) {
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
