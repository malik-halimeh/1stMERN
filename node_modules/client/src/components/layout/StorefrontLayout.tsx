import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Heart, ShoppingBag, X, Menu, ChevronDown, ChevronRight, Check } from 'lucide-react';
import Breadcrumb from '../ui/Breadcrumb.js';
import type { BreadcrumbItem } from '../ui/Breadcrumb.js';
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
            <a href="/" className="text-h2 font-bold tracking-tight text-primary-dark select-none flex items-center gap-1">
              Opti<span className="text-primary">Cart</span>
            </a>
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
                      <a
                        href={`/products/${product.slug}`}
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
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-2 lg:gap-4 select-none">
            <a
              href="/account"
              className="p-2 text-text-secondary hover:text-primary-dark hover:bg-dashboard-section-bg rounded-full transition-colors flex items-center"
              aria-label="Account"
            >
              <User className="h-5.5 w-5.5" />
            </a>
            <a
              href="/wishlist"
              className="p-2 text-text-secondary hover:text-danger hover:bg-dashboard-section-bg rounded-full transition-colors flex items-center relative"
              aria-label="Wishlist"
            >
              <Heart className="h-5.5 w-5.5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent" />
            </a>
            <a
              href="/cart"
              className="p-2 text-text-secondary hover:text-primary hover:bg-dashboard-section-bg rounded-full transition-colors flex items-center relative"
              aria-label="Cart"
            >
              <ShoppingBag className="h-5.5 w-5.5" />
              <span className="absolute top-0.5 right-0.5 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                3
              </span>
            </a>
          </div>
        </div>

        {/* Row 2: Category Nav w/ Mega Menu (Desktop only) */}
        <div className="hidden lg:block border-t border-dashboard-section-bg">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex items-center gap-8 py-3 select-none">
              {CATEGORIES.map((category) => (
                <div
                  key={category.name}
                  className="relative group"
                  onMouseEnter={() => setActiveCategory(category.name)}
                  onMouseLeave={() => setActiveCategory(null)}
                >
                  <button className="flex items-center gap-1.5 text-secondary text-sm font-semibold text-text-secondary hover:text-primary transition-colors py-1">
                    <span>{category.name}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {/* Mega Menu Panel */}
                  {activeCategory === category.name && (
                    <div className="absolute left-0 mt-3 w-[720px] bg-surface border border-text-disabled rounded-dropdown shadow-level3 z-50 p-6 flex gap-6 animate-scale-in">
                      {/* Left: Category Info */}
                      <div className="w-1/3 border-r border-dashboard-section-bg pr-6">
                        <h4 className="text-sm font-bold text-primary-dark uppercase tracking-wider mb-2">
                          {category.name}
                        </h4>
                        <p className="text-caption text-text-secondary">
                          Explore our collection of premium quality appliances for your home.
                        </p>
                      </div>

                      {/* Middle: Subcategories */}
                      <div className="w-1/3">
                        <h5 className="text-caption font-bold text-text-muted uppercase tracking-wider mb-3">
                          Subcategories
                        </h5>
                        <ul className="flex flex-col gap-2">
                          {category.subcategories.map((sub) => (
                            <li key={sub}>
                              <a
                                href={`/category/${sub.toLowerCase().replace(/ & /g, '-')}`}
                                className="text-sm text-text-secondary hover:text-primary flex items-center justify-between group/item"
                              >
                                <span>{sub}</span>
                                <ChevronRight className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover/item:opacity-100 transition-opacity" />
                              </a>
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
                            <a
                              key={feat.id}
                              href={`/products/${feat.id}`}
                              className="flex items-center gap-3 p-2 bg-surface rounded-image hover:shadow-level1 transition-shadow"
                            >
                              <span className="text-2xl">{feat.image}</span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-text-primary truncate">{feat.name}</p>
                                <span className="text-xs text-primary font-bold">{feat.price}</span>
                              </div>
                            </a>
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
              <a href="/" className="text-h2 font-bold text-primary-dark">
                Opti<span className="text-primary">Cart</span>
              </a>
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
              <li><a href="/category/major-appliances" className="hover:text-white transition-colors">Major Appliances</a></li>
              <li><a href="/category/small-appliances" className="hover:text-white transition-colors">Small Appliances</a></li>
              <li><a href="/promotions" className="hover:text-white transition-colors">Special Offers</a></li>
              <li><a href="/new-arrivals" className="hover:text-white transition-colors">New Releases</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-secondary font-semibold text-white mb-4">Customer Care</h4>
            <ul className="flex flex-col gap-2 text-caption text-text-muted">
              <li><a href="/support" className="hover:text-white transition-colors">Help Center</a></li>
              <li><a href="/shipping" className="hover:text-white transition-colors">Shipping & Delivery</a></li>
              <li><a href="/returns" className="hover:text-white transition-colors">Returns & Refunds</a></li>
              <li><a href="/warranty" className="hover:text-white transition-colors">Warranty Policies</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-secondary font-semibold text-white mb-4">Corporate</h4>
            <ul className="flex flex-col gap-2 text-caption text-text-muted">
              <li><a href="/about" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="/careers" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-white transition-colors">Terms of Service</a></li>
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
