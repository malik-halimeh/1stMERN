import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Heart, ShoppingBag, X, Menu, ChevronDown, ChevronRight, LogOut, LayoutDashboard } from 'lucide-react';
import Breadcrumb from '../ui/Breadcrumb.js';
import type { BreadcrumbItem } from '../ui/Breadcrumb.js';
import NotificationBell from '../ui/NotificationBell.js';
import { useAuth } from '../../context/AuthContext.js';
import { useShop } from '../../context/ShopContext.js';
import api from '../../services/api.js';

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

      {/* 2. Sticky Header — single slim row: logo, category nav, actions */}
      <header className="sticky top-0 z-40 bg-surface border-b border-dashboard-section-bg shadow-level1">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-6">
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

          {/* Category Nav (desktop) — real categories, compact hover dropdowns */}
          <nav className="hidden lg:flex items-center gap-1 flex-grow select-none">
            <Link
              to="/products"
              className="px-3 py-2 rounded-btn text-sm font-semibold text-text-secondary hover:text-primary hover:bg-dashboard-section-bg transition-colors"
            >
              All Products
            </Link>

            {categories.map((cat) => {
              const isOpen = activeCategory === cat._id;
              const hasSubs = (cat.subcategories?.length ?? 0) > 0;
              return (
                /* py-3/-my-3 bridges the hover gap between button and panel;
                   handleMenuLeave adds a 180 ms close delay on top */
                <div
                  key={cat._id}
                  className="relative py-3 -my-3"
                  onMouseEnter={() => hasSubs && handleMenuEnter(cat._id)}
                  onMouseLeave={handleMenuLeave}
                >
                  <button
                    onClick={() => goToCategory(cat.slug)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-btn text-sm font-semibold transition-colors ${
                      isOpen
                        ? 'text-primary bg-primary/5'
                        : 'text-text-secondary hover:text-primary hover:bg-dashboard-section-bg'
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
          </nav>

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
