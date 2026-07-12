import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  User,
  Heart,
  ShoppingBag,
  X,
  Menu,
  ChevronDown,
  ChevronRight,
  LogOut,
  LayoutDashboard,
  Search,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';

// Brand glyphs — newer lucide-react versions no longer ship social brand icons
const brandIcon = (path: string) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
    <path d={path} />
  </svg>
);

const SOCIAL_LINKS = [
  {
    label: 'Facebook',
    icon: brandIcon(
      'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'
    ),
  },
  {
    label: 'Instagram',
    icon: brandIcon(
      'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 5.838a6 6 0 100 12 6 6 0 000-12zm0 9.9a3.9 3.9 0 110-7.8 3.9 3.9 0 010 7.8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z'
    ),
  },
  {
    label: 'X (Twitter)',
    icon: brandIcon(
      'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'
    ),
  },
  {
    label: 'YouTube',
    icon: brandIcon(
      'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z'
    ),
  },
];
import Breadcrumb from '../ui/Breadcrumb.js';
import type { BreadcrumbItem } from '../ui/Breadcrumb.js';
import NotificationBell from '../ui/NotificationBell.js';
import { useAuth } from '../../context/AuthContext.js';
import { useShop } from '../../context/ShopContext.js';
import api from '../../services/api.js';
import { resolveGalleryImage } from '../../utils/productImage.js';
import type { ProductDoc } from '../ui/ProductCard.js';

interface StorefrontLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

// Real categories fetched from the API (GET /categories) — the nav links use
// their slugs, which is what the shop page's ?category= filter expects
interface NavCategory {
  _id: string;
  name: string;
  slug: string;
  subcategories?: { _id: string; name: string; slug: string }[];
}

const StorefrontLayout: React.FC<StorefrontLayoutProps> = ({ children, breadcrumbs }) => {
  // Announcement Bar State
  const [showAnnounce, setShowAnnounce] = useState(true);

  // Category nav — live data + hover dropdown state (keyed by category id)
  const [categories, setCategories] = useState<NavCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get('/categories')
      .then((res) => {
        if (res.data?.success) setCategories(res.data.data || []);
      })
      .catch((err) => console.error('Failed to load nav categories:', err));
  }, []);

  const goToCategory = (slug: string) => {
    setActiveCategory(null);
    setIsMobileMenuOpen(false);
    navigate(`/products?category=${encodeURIComponent(slug)}`);
  };

  // Auth state
  const { user, isAuthenticated, logout } = useAuth();
  // Live cart quantity + wishlist size for the header badges
  const { cartCount, wishlistIds } = useShop();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setShowUserMenu(false);
    try {
      await logout();
    } catch { /* swallow — logout clears state regardless */ }
    navigate('/');
  };

  // Close user menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced mega-menu open/close — 180 ms close delay prevents accidental
  // collapse when the mouse travels through the gap between trigger and panel.
  const handleMenuEnter = useCallback((name: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActiveCategory(name);
  }, []);

  const handleMenuLeave = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      setActiveCategory(null);
    }, 180);
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Mobile Drawer State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMobileCategory, setExpandedMobileCategory] = useState<string | null>(null);

  // Header search — lives in the sticky header so it stays put while the page
  // scrolls. Submitting routes to the shop page, which reads ?search= itself.
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');

  // Live "as-you-type" suggestions shown under the search box
  const [suggestions, setSuggestions] = useState<ProductDoc[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the box in sync when the URL's search param changes (e.g. back button)
  useEffect(() => {
    setSearchQuery(searchParams.get('search') || '');
  }, [searchParams]);

  // Debounced fetch of the top matches while typing. The server ranks results
  // exact-name-first, so suggestions[0] is always the closest product.
  useEffect(() => {
    const q = searchQuery.trim();
    if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
    if (!q) {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }
    suggestDebounce.current = setTimeout(async () => {
      try {
        const res = await api.get('/products', { params: { search: q, inStock: 1, limit: 6 } });
        if (res.data?.success) {
          setSuggestions(res.data.data);
          setActiveIndex(-1);
        }
      } catch {
        /* suggestions are best-effort; ignore transient errors */
      }
    }, 180);
    return () => {
      if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
    };
  }, [searchQuery]);

  const goToResults = (q: string) => {
    setSearchFocused(false);
    navigate(q.trim() ? `/products?search=${encodeURIComponent(q.trim())}` : '/products');
  };

  const goToProduct = (slug: string) => {
    setSearchFocused(false);
    navigate(`/products/${slug}`);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    goToResults(searchQuery);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      goToProduct(suggestions[activeIndex].slug);
    } else if (e.key === 'Escape') {
      setSearchFocused(false);
    }
  };

  const showSuggestions = searchFocused && searchQuery.trim().length > 0 && suggestions.length > 0;

  const searchBox = (
    <form onSubmit={submitSearch} className="relative w-full" role="search" autoComplete="off">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
        onKeyDown={onSearchKeyDown}
        placeholder="Search appliances…"
        aria-label="Search products"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls="search-suggestions"
        className="w-full rounded-full border border-text-disabled bg-dashboard-section-bg/60 pl-10 pr-20 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent focus:bg-surface transition-colors [&::-webkit-search-cancel-button]:hidden"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          className="absolute right-14 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary rounded-full"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="submit"
        className="absolute right-1 top-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary-dark transition-colors"
      >
        Search
      </button>

      {/* As-you-type suggestions */}
      {showSuggestions && (
        <div
          id="search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 bg-surface border border-dashboard-section-bg rounded-card shadow-level2 overflow-hidden z-50"
        >
          {suggestions.map((p, i) => {
            const img = resolveGalleryImage(p);
            return (
              <button
                key={p._id}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                // onMouseDown fires before the input's onBlur, so navigation isn't cancelled
                onMouseDown={(e) => {
                  e.preventDefault();
                  goToProduct(p.slug);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex items-center gap-3 w-full px-3 py-2 text-left transition-colors ${
                  i === activeIndex ? 'bg-dashboard-section-bg/60' : 'hover:bg-dashboard-section-bg/40'
                }`}
              >
                <span className="h-10 w-10 flex-shrink-0 rounded bg-dashboard-section-bg/50 flex items-center justify-center overflow-hidden">
                  {img ? (
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-base">🧊</span>
                  )}
                </span>
                <span className="min-w-0 flex-grow">
                  <span className="block text-sm font-medium text-text-primary truncate">{p.name}</span>
                  {p.brand && <span className="block text-xs text-text-muted truncate">{p.brand}</span>}
                </span>
                <span className="text-sm font-semibold text-primary flex-shrink-0">
                  ${(p.basePriceCents / 100).toFixed(2)}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              goToResults(searchQuery);
            }}
            className="block w-full px-3 py-2 text-center text-xs font-semibold text-primary hover:bg-dashboard-section-bg/40 border-t border-dashboard-section-bg transition-colors"
          >
            See all results for “{searchQuery.trim()}”
          </button>
        </div>
      )}
    </form>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-text-primary font-sans">
      {/* 1. Announcement Bar */}
      {showAnnounce && (
        <div className="bg-primary-dark text-white pl-4 pr-10 py-2 text-center text-caption font-medium relative flex items-center justify-center select-none">
          <span>🎉 Grand Opening Special: Get 10% off all Major Appliances! Use code: OPTI10</span>
          <button
            onClick={() => setShowAnnounce(false)}
            className="absolute right-4 text-white/80 hover:text-white focus:outline-none transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Sticky Header — row 1: logo, search, actions; row 2: category nav.
          The whole block is sticky, so the search bar stays in place on scroll. */}
      <header className="sticky top-0 z-40 bg-surface border-b border-dashboard-section-bg shadow-level1">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3 sm:gap-6">
          {/* Logo & Mobile Menu Toggle */}
          <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-1 text-text-secondary hover:bg-dashboard-section-bg rounded-btn"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Link to="/" className="text-h2 font-bold tracking-tight text-primary-dark select-none flex items-center gap-1">
              Opti<span className="text-primary">Cart</span>
            </Link>
          </div>

          {/* Search — centered, always visible on ≥md screens */}
          <div className="hidden md:block flex-grow max-w-xl mx-auto">{searchBox}</div>

          {/* Action Icons */}
          <div className="flex items-center gap-2 lg:gap-3 select-none ml-auto">

            {/* Order status notifications — signed-in users only */}
            {isAuthenticated && <NotificationBell />}

            {/* ── User / Account / Logout ────────────────────────────────── */}
            {isAuthenticated && user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu((v) => !v)}
                  className="flex items-center gap-2 p-1.5 rounded-full hover:bg-dashboard-section-bg transition-colors focus:outline-none"
                  aria-label="Account menu"
                >
                  {/* Initials avatar */}
                  <span className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[11px] select-none shadow-level1">
                    {user.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-text-muted hidden sm:block" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-surface border border-text-disabled rounded-dropdown shadow-level2 py-2 z-50">
                    {/* Identity header */}
                    <div className="px-4 py-2 border-b border-dashboard-section-bg">
                      <p className="text-sm font-semibold text-text-primary truncate">{user.name}</p>
                      <p className="text-[11px] text-text-muted truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[9px] uppercase font-bold tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {user.role.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-col">
                      {/* Account page — all roles can shop, order, and manage addresses */}
                      <Link
                        to="/account"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:bg-dashboard-section-bg transition-colors"
                      >
                        <User className="h-4 w-4 text-text-muted" /> My Account
                      </Link>

                      {/* Admin panel (manager / admin) */}
                      {(user.role === 'inventory_manager' || user.role === 'super_admin') && (
                        <Link
                          to="/admin/dashboard"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:bg-dashboard-section-bg transition-colors"
                        >
                          <LayoutDashboard className="h-4 w-4 text-text-muted" /> Admin Panel
                        </Link>
                      )}

                      {/* Logout — all roles */}
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Guest: plain icon → login */
              <Link
                to="/login"
                className="p-2 text-text-secondary hover:text-primary-dark hover:bg-dashboard-section-bg rounded-full transition-colors flex items-center"
                aria-label="Sign in"
              >
                <User className="h-5 w-5" />
              </Link>
            )}

            <Link
              to="/wishlist"
              className="p-2 text-text-secondary hover:text-danger hover:bg-dashboard-section-bg rounded-full transition-colors flex items-center relative"
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" />
              {wishlistIds.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center leading-none select-none">
                  {wishlistIds.length > 99 ? '99+' : wishlistIds.length}
                </span>
              )}
            </Link>
            <Link
              to="/cart"
              className="p-2 text-text-secondary hover:text-primary hover:bg-dashboard-section-bg rounded-full transition-colors flex items-center relative"
              aria-label="Cart"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center leading-none select-none">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          </div>

        </div>

        {/* Mobile search — its own row inside the sticky header */}
        <div className="md:hidden px-4 pb-2.5">{searchBox}</div>

        {/* Category Nav (desktop) — second header row, real categories with hover dropdowns */}
        <nav className="hidden lg:block border-t border-dashboard-section-bg/70 select-none">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-1">
            <Link
              to="/products"
              className="px-3 py-2 text-sm font-semibold text-text-secondary hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary"
            >
              All Products
            </Link>

            {categories.map((cat) => {
              const isOpen = activeCategory === cat._id;
              const hasSubs = (cat.subcategories?.length ?? 0) > 0;
              return (
                /* handleMenuLeave adds a 180 ms close delay so the pointer can
                   travel from trigger to panel without collapsing it */
                <div
                  key={cat._id}
                  className="relative"
                  onMouseEnter={() => hasSubs && handleMenuEnter(cat._id)}
                  onMouseLeave={handleMenuLeave}
                >
                  <button
                    onClick={() => goToCategory(cat.slug)}
                    className={`flex items-center gap-1 px-3 py-2 text-sm font-semibold transition-colors border-b-2 ${
                      isOpen
                        ? 'text-primary border-primary'
                        : 'text-text-secondary border-transparent hover:text-primary hover:border-primary'
                    }`}
                    aria-haspopup={hasSubs}
                    aria-expanded={isOpen}
                  >
                    <span>{cat.name}</span>
                    {hasSubs && (
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </button>

                  {isOpen && hasSubs && (
                    <div className="absolute left-0 top-full w-60 bg-surface border border-dashboard-section-bg rounded-dropdown shadow-level3 py-2 z-50 animate-scale-in">
                      <button
                        onClick={() => goToCategory(cat.slug)}
                        className="w-full text-left px-4 py-2 text-sm font-bold text-primary hover:bg-dashboard-section-bg transition-colors"
                      >
                        All {cat.name}
                      </button>
                      <div className="my-1 border-t border-dashboard-section-bg" />
                      {cat.subcategories!.map((sub) => (
                        <button
                          key={sub._id}
                          onClick={() => goToCategory(sub.slug)}
                          className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-dashboard-section-bg hover:text-primary transition-colors flex items-center justify-between group/item"
                        >
                          <span>{sub.name}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>
      </header>

      {/* 3. Mobile Slide-out Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-text-primary/40 backdrop-blur-sm">
          <div className="w-4/5 max-w-sm bg-surface h-full flex flex-col shadow-level3 animate-slide-in">
            <div className="p-4 border-b border-dashboard-section-bg flex items-center justify-between">
              <Link to="/" className="text-h2 font-bold text-primary-dark">
                Opti<span className="text-primary">Cart</span>
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 text-text-secondary hover:bg-dashboard-section-bg rounded-btn"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Mobile Navigation Content */}
            <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4">
              {/* Category Tree Links — same live categories as the desktop nav */}
              <div>
                <h4 className="text-caption font-bold text-text-muted uppercase tracking-wider mb-2">Categories</h4>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      navigate('/products');
                    }}
                    className="w-full text-left text-sm font-semibold text-text-secondary hover:text-primary border-b border-dashboard-section-bg py-2.5"
                  >
                    All Products
                  </button>
                  {categories.map((cat) => {
                    const isExpanded = expandedMobileCategory === cat._id;
                    const hasSubs = (cat.subcategories?.length ?? 0) > 0;
                    return (
                      <div key={cat._id} className="border-b border-dashboard-section-bg py-2">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => goToCategory(cat.slug)}
                            className="flex-grow text-left text-sm font-semibold text-text-secondary hover:text-primary py-0.5"
                          >
                            {cat.name}
                          </button>
                          {hasSubs && (
                            <button
                              onClick={() => setExpandedMobileCategory(isExpanded ? null : cat._id)}
                              className="p-1.5 text-text-muted hover:text-text-primary rounded-btn hover:bg-dashboard-section-bg"
                              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${cat.name}`}
                            >
                              <ChevronDown className={`h-4 w-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                        </div>
                        {isExpanded && hasSubs && (
                          <ul className="mt-2 ml-1 flex flex-col border-l border-text-disabled pl-3">
                            {cat.subcategories!.map((sub) => (
                              <li key={sub._id}>
                                <button
                                  onClick={() => goToCategory(sub.slug)}
                                  className="w-full text-left text-sm text-text-secondary hover:text-primary py-1.5 block"
                                >
                                  {sub.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mobile Auth Section — bottom of drawer */}
            <div className="border-t border-dashboard-section-bg p-4">
              {isAuthenticated && user ? (
                <div className="flex flex-col gap-2">
                  {/* Identity */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {user.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{user.name}</p>
                      <span className="text-[9px] uppercase font-bold tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        {user.role.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <Link
                    to="/account"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-dashboard-section-bg rounded-btn"
                  >
                    <User className="h-4 w-4 text-text-muted" /> My Account
                  </Link>
                  {(user.role === 'inventory_manager' || user.role === 'super_admin') && (
                    <Link
                      to="/admin/dashboard"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-dashboard-section-bg rounded-btn"
                    >
                      <LayoutDashboard className="h-4 w-4 text-text-muted" /> Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-red-50 rounded-btn w-full text-left"
                  >
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-primary hover:bg-dashboard-section-bg rounded-btn"
                >
                  <User className="h-4 w-4" /> Sign In / Register
                </Link>
              )}
            </div>
          </div>
        </div>
      )}


      {/* 4. Breadcrumbs */}
      {breadcrumbs && <Breadcrumb items={breadcrumbs} />}

      {/* 5. Main Content Area */}
      <main className="flex-grow">
        {children}
      </main>

      {/* 6. Footer */}
      <footer className="bg-text-primary text-white font-sans mt-auto select-none">
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
          {/* Brand + socials */}
          <div className="col-span-2 lg:col-span-1">
            <Link to="/" className="text-h2 font-bold tracking-tight text-white inline-flex items-center gap-1">
              Opti<span className="text-primary">Cart</span>
            </Link>
            <p className="mt-3 text-sm text-white/60 max-w-xs leading-relaxed">
              Premium grade appliances engineered for modern families. Reliable products, secure
              payments, and expert installation.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="p-2.5 rounded-full bg-white/5 text-white/60 hover:bg-primary hover:text-white transition-colors"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Shop — live categories, same links as the header nav */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/90 mb-4">Shop</h4>
            <ul className="flex flex-col gap-2.5 text-sm text-white/60">
              <li>
                <Link to="/products" className="hover:text-primary transition-colors">All Products</Link>
              </li>
              {categories.slice(0, 4).map((cat) => (
                <li key={cat._id}>
                  <Link
                    to={`/products?category=${encodeURIComponent(cat.slug)}`}
                    className="hover:text-primary transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/products?sort=newest" className="hover:text-primary transition-colors">New Releases</Link>
              </li>
            </ul>
          </div>

          {/* Customer care */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/90 mb-4">Customer Care</h4>
            <ul className="flex flex-col gap-2.5 text-sm text-white/60">
              <li><Link to="/account" className="hover:text-primary transition-colors">My Account</Link></li>
              <li><Link to="/wishlist" className="hover:text-primary transition-colors">Wishlist</Link></li>
              <li><Link to="/cart" className="hover:text-primary transition-colors">Cart</Link></li>
              <li><Link to="/" className="hover:text-primary transition-colors">Shipping &amp; Delivery</Link></li>
              <li><Link to="/" className="hover:text-primary transition-colors">Returns &amp; Refunds</Link></li>
              <li><Link to="/" className="hover:text-primary transition-colors">Warranty Policies</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="col-span-2 lg:col-span-1">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/90 mb-4">Contact Us</h4>
            <ul className="flex flex-col gap-3 text-sm text-white/60">
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>123 Appliance Avenue, Suite 500<br />Springfield, ST 12345</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                <a href="tel:+18005550123" className="hover:text-primary transition-colors">+1 (800) 555-0123</a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary flex-shrink-0" />
                <a href="mailto:support@opticart.dev" className="hover:text-primary transition-colors">support@opticart.dev</a>
              </li>
            </ul>
            <p className="mt-4 text-caption text-white/40">Support hours: Mon–Sat, 9:00–18:00</p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-caption text-white/50 text-center sm:text-left">
              © {new Date().getFullYear()} OptiCart Appliances Inc. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-caption text-white/50">
              <Link to="/" className="hover:text-white transition-colors">Privacy Policy</Link>
              <span className="text-white/20">·</span>
              <Link to="/" className="hover:text-white transition-colors">Terms of Service</Link>
            </div>
            <div className="flex items-center gap-1.5" aria-label="Accepted payment methods">
              {['VISA', 'Mastercard', 'AMEX', 'Stripe'].map((p) => (
                <span
                  key={p}
                  className="px-2 py-1 rounded border border-white/15 bg-white/5 text-[10px] font-bold tracking-wide text-white/60"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StorefrontLayout;
