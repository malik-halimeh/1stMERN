import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, User, Heart, ShoppingBag, X, Menu, ChevronDown, ChevronRight, Check, LogOut, LayoutDashboard } from 'lucide-react';
import Breadcrumb from '../ui/Breadcrumb.js';
import type { BreadcrumbItem } from '../ui/Breadcrumb.js';
import { useAuth } from '../../context/AuthContext.js';
import { useShop } from '../../context/ShopContext.js';
import api from '../../services/api.js';

interface StorefrontLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}



const CATEGORIES = [
  {
    name: 'Major Appliances',
    subcategories: ['Refrigerators', 'Ranges & Ovens', 'Dishwashers', 'Washers & Dryers'],
    featured: [
      { id: '1', name: 'French Door Refrigerator', price: '$1,899.00', image: '🧊' },
      { id: '2', name: 'Smart Induction Range', price: '$1,249.00', image: '🍳' }
    ]
  },
  {
    name: 'Small Appliances',
    subcategories: ['Microwaves', 'Coffee Makers', 'Blenders & Juicers', 'Toasters & Ovens'],
    featured: [
      { id: '6', name: 'Espresso Bar Coffee Machine', price: '$599.00', image: '☕' },
      { id: '7', name: 'Professional Blender', price: '$189.00', image: '🥤' }
    ]
  }
];

interface SuggestionProduct {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: string;
  available: boolean;
  thumbnail: string;
}

const StorefrontLayout: React.FC<StorefrontLayoutProps> = ({ children, breadcrumbs }) => {
  // Announcement Bar State
  const [showAnnounce, setShowAnnounce] = useState(true);

  // Search Live Suggestion States
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionProduct[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Mega Menu Hover State
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

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

  // Close search suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update suggestions on search query change (Debounced 300ms API query)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await api.get(`/products?search=${encodeURIComponent(searchQuery)}&limit=5`);
        if (response.data?.success) {
          const mapped = response.data.data.map((p: any) => {
            const defaultVariant = p.variants?.[0];
            const currentPrice = defaultVariant ? p.basePriceCents + defaultVariant.priceDeltaCents : p.basePriceCents;
            return {
              id: p._id,
              slug: p.slug,
              name: p.name,
              category: p.brand || 'Appliance',
              price: `$${(currentPrice / 100).toFixed(2)}`,
              available: p.variants?.some((v: any) => v.stock > 0),
              thumbnail: p.images?.[0]?.url || '',
            };
          });
          setSuggestions(mapped);
        }
      } catch (err) {
        console.error('Debounced suggestions fetch failed:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Helper function to highlight matching search text
  const renderHighlightedText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-amber-100 text-text-primary font-semibold">{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-text-primary font-sans">
      {/* 1. Announcement Bar */}
      {showAnnounce && (
        <div className="bg-primary-dark text-white px-4 py-2 text-center text-caption font-medium relative flex items-center justify-center select-none">
          <span>🎉 Grand Opening Special: Get 10% off all Major Appliances! Use code: OPTI10</span>
          <button
            onClick={() => setShowAnnounce(false)}
            className="absolute right-4 text-white/80 hover:text-white focus:outline-none transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Sticky Header */}
      <header className="sticky top-0 z-40 bg-surface border-b border-dashboard-section-bg shadow-level1">
        {/* Row 1: Main Bar */}
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          {/* Logo & Mobile Menu Toggle */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-1 text-text-secondary hover:bg-dashboard-section-bg rounded-btn"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Link to="/" className="text-h2 font-bold tracking-tight text-primary-dark select-none flex items-center gap-1">
              Opti<span className="text-primary">Cart</span>
            </Link>
          </div>

          {/* Search Bar w/ Live Suggestions */}
          <div ref={searchContainerRef} className="hidden md:block flex-grow max-w-xl relative">
            <div className="relative">
              <input
                type="text"
                placeholder="Search appliances (e.g. refrigerator, coffee)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                className="w-full pl-10 pr-4 py-2 border border-text-disabled rounded-input bg-surface text-body placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
              <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-text-muted" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-3 text-text-muted hover:text-text-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-surface border border-text-disabled rounded-dropdown shadow-level2 overflow-hidden z-50">
                <div className="p-2 border-b border-dashboard-section-bg bg-background text-caption text-text-muted font-medium">
                  Search Suggestions ({suggestions.length})
                </div>
                <ul className="divide-y divide-dashboard-section-bg max-h-80 overflow-y-auto">
                  {suggestions.map((product) => (
                    <li key={product.id}>
                      <Link
                        to={`/products/${product.slug}`}
                        onClick={() => { setShowSuggestions(false); setSearchQuery(''); }}
                        className="flex items-center gap-4 p-3 hover:bg-dashboard-section-bg transition-colors"
                      >
                        {product.thumbnail ? (
                          <img src={product.thumbnail} className="w-10 h-10 object-cover rounded-image flex-shrink-0" />
                        ) : (
                          <span className="text-2xl p-1.5 bg-background rounded-image flex-shrink-0">🧊</span>
                        )}
                        <div className="flex-grow min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {renderHighlightedText(product.name, searchQuery)}
                          </p>
                          <span className="text-caption text-text-muted">{product.category}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-primary">{product.price}</p>
                          {product.available ? (
                            <span className="text-caption text-success font-medium flex items-center justify-end gap-1">
                              <Check className="h-3 w-3" /> In Stock
                            </span>
                          ) : (
                            <span className="text-caption text-danger font-medium">Out of Stock</span>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-2 lg:gap-3 select-none">

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

        {/* Row 2: Category Nav w/ Mega Menu (Desktop only) */}
        <div className="hidden lg:block border-t border-dashboard-section-bg">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex items-center gap-8 py-3 select-none">
              {CATEGORIES.map((category) => (
                /*
                 * HOVER-STABILITY FIX:
                 * pt-3 extends the wrapper's hit-area downward to bridge the gap
                 * between the trigger button and the absolutely-positioned panel,
                 * so mouseleave doesn't fire while the cursor travels that gap.
                 * The debounced handleMenuLeave adds a 180 ms safety window on top.
                 */
                <div
                  key={category.name}
                  className="relative pt-3 -mt-3" // pt-3/-mt-3 bridge: extends bounding box without shifting layout
                  onMouseEnter={() => handleMenuEnter(category.name)}
                  onMouseLeave={handleMenuLeave}
                >
                  <button
                    className="flex items-center gap-1.5 text-secondary text-sm font-semibold text-text-secondary hover:text-primary transition-colors py-1"
                    aria-haspopup="true"
                    aria-expanded={activeCategory === category.name}
                  >
                    <span>{category.name}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        activeCategory === category.name ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Mega Menu Panel — top-full flush against the button, inside
                      the wrapper's padded hit-area so no dead zone exists */}
                  {activeCategory === category.name && (
                    <div className="absolute left-0 top-full w-[720px] bg-surface border border-text-disabled rounded-dropdown shadow-level3 z-50 p-6 flex gap-6 animate-scale-in">
                      {/* Left: Category description */}
                      <div className="w-1/3 border-r border-dashboard-section-bg pr-6">
                        <h4 className="text-sm font-bold text-primary-dark uppercase tracking-wider mb-2">
                          {category.name}
                        </h4>
                        <p className="text-caption text-text-secondary">
                          Explore our collection of premium quality appliances for your home.
                        </p>
                      </div>

                      {/* Middle: Subcategories — button + navigate for SPA nav + menu close */}
                      <div className="w-1/3">
                        <h5 className="text-caption font-bold text-text-muted uppercase tracking-wider mb-3">
                          Subcategories
                        </h5>
                        <ul className="flex flex-col gap-2">
                          {category.subcategories.map((sub) => (
                            <li key={sub}>
                              <button
                                onClick={() => {
                                  setActiveCategory(null);
                                  navigate(`/products?category=${encodeURIComponent(sub)}`);
                                }}
                                className="w-full text-left text-sm text-text-secondary hover:text-primary flex items-center justify-between group/item"
                              >
                                <span>{sub}</span>
                                <ChevronRight className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover/item:opacity-100 transition-opacity" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Right: Featured Products */}
                      <div className="w-1/3 bg-dashboard-section-bg/40 rounded-card p-4">
                        <h5 className="text-caption font-bold text-text-muted uppercase tracking-wider mb-3">
                          Featured Products
                        </h5>
                        <div className="flex flex-col gap-3">
                          {category.featured.map((feat) => (
                            <button
                              key={feat.id}
                              onClick={() => {
                                setActiveCategory(null);
                                navigate(`/products/${feat.id}`);
                              }}
                              className="w-full text-left flex items-center gap-3 p-2 bg-surface rounded-image hover:shadow-level1 transition-shadow"
                            >
                              <span className="text-2xl">{feat.image}</span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-text-primary truncate">{feat.name}</p>
                                <span className="text-xs text-primary font-bold">{feat.price}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>
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
              {/* Search Bar for Mobile */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search appliances..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-text-disabled rounded-input bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
                <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-text-muted" />
              </div>

              {/* Category Tree Links */}
              <div>
                <h4 className="text-caption font-bold text-text-muted uppercase tracking-wider mb-2">Categories</h4>
                <div className="flex flex-col gap-1">
                  {CATEGORIES.map((category) => {
                    const isExpanded = expandedMobileCategory === category.name;
                    return (
                      <div key={category.name} className="border-b border-dashboard-section-bg py-2">
                        <button
                          onClick={() => setExpandedMobileCategory(isExpanded ? null : category.name)}
                          className="w-full flex items-center justify-between text-secondary text-sm font-semibold text-text-secondary"
                        >
                          <span>{category.name}</span>
                          <ChevronDown className={`h-4 w-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isExpanded && (
                          <ul className="mt-2 ml-4 flex flex-col gap-2 border-l border-text-disabled pl-3">
                            {category.subcategories.map((sub) => (
                              <li key={sub}>
                                <a
                                  href={`/category/${sub.toLowerCase().replace(/ & /g, '-')}`}
                                  className="text-sm text-text-secondary hover:text-primary py-1 block"
                                >
                                  {sub}
                                </a>
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
      <footer className="bg-primary-dark text-white border-t border-text-secondary/20 font-sans mt-auto select-none">
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-h3 font-bold text-white mb-4">OptiCart</h3>
            <p className="text-caption text-text-muted max-w-xs leading-relaxed">
              Premium grade appliances engineered for modern families. Reliable products, secure payments, and expert installation.
            </p>
          </div>
          <div>
            <h4 className="text-secondary font-semibold text-white mb-4">Categories</h4>
            <ul className="flex flex-col gap-2 text-caption text-text-muted">
              <li><Link to="/products?category=major-appliances" className="hover:text-white transition-colors">Major Appliances</Link></li>
              <li><Link to="/products?category=small-appliances" className="hover:text-white transition-colors">Small Appliances</Link></li>
              <li><Link to="/products" className="hover:text-white transition-colors">Special Offers</Link></li>
              <li><Link to="/products?sort=newest" className="hover:text-white transition-colors">New Releases</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-secondary font-semibold text-white mb-4">Customer Care</h4>
            <ul className="flex flex-col gap-2 text-caption text-text-muted">
              <li><Link to="/" className="hover:text-white transition-colors">Help Center</Link></li>
              <li><Link to="/" className="hover:text-white transition-colors">Shipping &amp; Delivery</Link></li>
              <li><Link to="/" className="hover:text-white transition-colors">Returns &amp; Refunds</Link></li>
              <li><Link to="/" className="hover:text-white transition-colors">Warranty Policies</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-secondary font-semibold text-white mb-4">Corporate</h4>
            <ul className="flex flex-col gap-2 text-caption text-text-muted">
              <li><Link to="/" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/" className="hover:text-white transition-colors">Careers</Link></li>
              <li><Link to="/" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-text-secondary/10 py-6 text-center text-caption text-text-muted">
          © {new Date().getFullYear()} OptiCart Appliances Inc. All rights reserved. University Graded Project.
        </div>
      </footer>
    </div>
  );
};

export default StorefrontLayout;
