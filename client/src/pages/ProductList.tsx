import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StorefrontLayout from '../components/layout/StorefrontLayout.js';
import ProductCard from '../components/ui/ProductCard.js';
import type { ProductDoc } from '../components/ui/ProductCard.js';
import Skeleton from '../components/ui/Skeleton.js';
import Button from '../components/ui/Button.js';
import EmptyState from '../components/ui/EmptyState.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { useShop } from '../context/ShopContext.js';
import api from '../services/api.js';
import { getApiErrorMessage } from '../utils/apiError.js';
import { Filter, SlidersHorizontal, ChevronLeft, ChevronRight, Star, X, WifiOff } from 'lucide-react';

interface CategoryDoc {
  _id: string;
  name: string;
  slug: string;
}

// Shape returned by GET /categories (parent with nested children)
interface ApiCategory {
  _id: string;
  name: string;
  slug: string;
  subcategories?: { _id: string; name: string; slug: string }[];
}

const ProductList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const { addItemToCart, addItemToWishlist, isInWishlist } = useShop();

  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  const [isLoading, setIsLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const retry = () => setReloadKey((k) => k + 1);

  // Re-fetch automatically once connectivity returns after a failed load
  useEffect(() => {
    if (!fetchFailed) return;
    const handleOnline = () => retry();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchFailed]);

  // Read current filters from URL search params
  const categoryParam = searchParams.get('category') || '';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';
  const ratingParam = searchParams.get('rating') || '';
  const sortParam = searchParams.get('sort') || 'newest';
  const pageParam = parseInt(searchParams.get('page') || '1');
  const searchParam = searchParams.get('search') || '';

  // Local filter states for inputs
  const [minPriceInput, setMinPriceInput] = useState(minPriceParam);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPriceParam);

  // Sync inputs on URL param changes
  useEffect(() => {
    setMinPriceInput(minPriceParam);
    setMaxPriceInput(maxPriceParam);
  }, [minPriceParam, maxPriceParam]);

  // Fetch categories list
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories');
        if (res.data?.success) {
          // Flatten child categories for simple sidebar options
          const flat: CategoryDoc[] = [];
          res.data.data.forEach((cat: ApiCategory) => {
            flat.push({ _id: cat._id, name: cat.name, slug: cat.slug });
            cat.subcategories?.forEach((sub) => {
              flat.push({ _id: sub._id, name: `↳ ${sub.name}`, slug: sub.slug });
            });
          });
          setCategories(flat);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, [reloadKey]);

  // Fetch products catalog on filter alterations
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', pageParam.toString());
        queryParams.set('limit', '12'); // 12 items per page
        if (categoryParam) queryParams.set('category', categoryParam);
        if (minPriceParam) queryParams.set('minPrice', minPriceParam);
        if (maxPriceParam) queryParams.set('maxPrice', maxPriceParam);
        if (ratingParam) queryParams.set('rating', ratingParam);
        if (sortParam) queryParams.set('sort', sortParam);
        if (searchParam) queryParams.set('search', searchParam);
        queryParams.set('inStock', '1'); // storefront never lists sold-out products

        const res = await api.get(`/products?${queryParams.toString()}`);
        if (res.data?.success) {
          setProducts(res.data.data);
          setTotalProducts(res.data.meta.total);
          setTotalPages(res.data.meta.pages);
          setFetchFailed(false);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
        setFetchFailed(true);
        addToast('Error fetching products. Please reload.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, [categoryParam, minPriceParam, maxPriceParam, ratingParam, sortParam, pageParam, searchParam, reloadKey]);

  // Update query parameters in URL
  const updateFilters = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    // Always reset page index back to 1 on filter change
    if (key !== 'page') {
      newParams.set('page', '1');
    }
    setSearchParams(newParams);
  };

  // Price inputs only accept zero or positive numbers (blocks "-5", "-" …)
  const sanitizePrice = (value: string): string | null => {
    if (value === '') return '';
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 ? value : null;
  };

  const handleApplyPriceFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    const min = parseFloat(minPriceInput);
    const max = parseFloat(maxPriceInput);
    if (!isNaN(min) && min >= 0) newParams.set('minPrice', String(min));
    else newParams.delete('minPrice');
    if (!isNaN(max) && max >= 0) newParams.set('maxPrice', String(max));
    else newParams.delete('maxPrice');
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleClearFilters = () => {
    setMinPriceInput('');
    setMaxPriceInput('');
    setSearchParams(new URLSearchParams());
  };

  // Add to Cart handler — updates the shared header badge count (guest + auth)
  const handleAddToCart = async (productId: string, variantSku: string) => {
    try {
      const status = await addItemToCart(productId, variantSku, 1);
      if (status === 'exists') {
        addToast('This product is already in your cart.', 'info');
      } else {
        addToast('Product added to cart.', 'success');
      }
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Could not add item to cart.'), 'error');
    }
  };

  // Add to Wishlist handler — duplicate-aware (guest + auth)
  const handleAddToWishlist = async (productId: string) => {
    try {
      const result = await addItemToWishlist(productId);
      if (result === 'exists') {
        addToast('Item is already in your wishlist.', 'info');
      } else if (user) {
        addToast('Item added to your wishlist!', 'success');
      } else {
        addToast('Item saved to your local wishlist! Sign in to sync across devices.', 'success');
      }
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Failed to update wishlist.'), 'error');
    }
  };

  // Sidebar Filters Panel JSX Content.
  // NOTE: this is a render *helper* called as {renderFiltersSidebar()} — NOT
  // rendered as <Component/>. Rendering it as an element would give it a new
  // identity on every keystroke, remounting the subtree and stealing focus
  // from the price inputs after each character typed.
  const renderFiltersSidebar = () => (
    <div className="flex flex-col gap-6 font-sans">
      {/* Category selection */}
      <div>
        <h5 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3">Categories</h5>
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
          <button
            onClick={() => updateFilters('category', '')}
            className={`text-left text-sm py-1 font-medium transition-colors ${
              !categoryParam ? 'text-primary font-bold' : 'text-text-secondary hover:text-primary'
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() => updateFilters('category', cat.slug)}
              className={`text-left text-sm py-1 font-medium transition-colors ${
                categoryParam === cat.slug ? 'text-primary font-bold' : 'text-text-secondary hover:text-primary'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range selection */}
      <div className="border-t border-dashboard-section-bg pt-6">
        <h5 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3">Price Range ($)</h5>
        {/* Min/Max share a full-width row; the Go button sits on its own row
            below so each box is wide enough to show several digits at once. */}
        <form onSubmit={handleApplyPriceFilter} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              id="min-price"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Min"
              value={minPriceInput}
              onChange={(e) => {
                const v = sanitizePrice(e.target.value);
                if (v !== null) setMinPriceInput(v);
              }}
              className="w-full min-w-0 px-2 py-2 text-sm border rounded-input bg-surface text-text-primary placeholder:text-text-muted border-text-disabled hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-text-muted shrink-0">–</span>
            <input
              id="max-price"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Max"
              value={maxPriceInput}
              onChange={(e) => {
                const v = sanitizePrice(e.target.value);
                if (v !== null) setMaxPriceInput(v);
              }}
              className="w-full min-w-0 px-2 py-2 text-sm border rounded-input bg-surface text-text-primary placeholder:text-text-muted border-text-disabled hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <Button type="submit" variant="secondary" className="w-full text-xs py-1.5 border border-dashboard-section-bg hover:bg-dashboard-section-bg/50">
            Go
          </Button>
        </form>
      </div>

      {/* Star ratings */}
      <div className="border-t border-dashboard-section-bg pt-6">
        <h5 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3">Minimum Rating</h5>
        <div className="flex flex-col gap-2">
          {[4, 3, 2, 1].map((stars) => (
            <button
              key={stars}
              onClick={() => updateFilters('rating', stars.toString())}
              className={`flex items-center gap-2 text-sm text-left font-medium transition-colors ${
                ratingParam === stars.toString() ? 'text-primary font-bold' : 'text-text-secondary hover:text-primary'
              }`}
            >
              <div className="flex text-amber-400">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
                {Array.from({ length: 5 - stars }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 text-text-disabled" />
                ))}
              </div>
              <span>& Up</span>
            </button>
          ))}
          {ratingParam && (
            <button
              onClick={() => updateFilters('rating', '')}
              className="text-left text-xs font-semibold text-secondary hover:text-accent mt-1"
            >
              Clear Rating Filter
            </button>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        onClick={handleClearFilters}
        className="w-full mt-2 text-xs py-2 border border-dashboard-section-bg/85"
      >
        Reset All Filters
      </Button>
    </div>
  );

  return (
    <StorefrontLayout>
      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8 min-h-screen">
        {/* A. Sticky Desktop Filter Sidebar */}
        <aside className="hidden lg:block w-64 flex-shrink-0 sticky top-24 self-start bg-surface border border-dashboard-section-bg/50 rounded-card p-6 shadow-level1">
          <h4 className="text-h3 font-bold mb-6 text-primary-dark flex items-center gap-2 border-b border-dashboard-section-bg pb-3">
            <Filter className="h-4.5 w-4.5 text-primary" /> Filters
          </h4>
          {renderFiltersSidebar()}
        </aside>

        {/* B. Products Content panel */}
        <div className="flex-grow flex flex-col gap-6">
          {/* Header toolbar */}
          <div className="bg-surface border border-dashboard-section-bg/50 p-4 rounded-card shadow-level1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 font-sans select-none">
            <div className="text-left min-w-0">
              <span className="text-caption text-text-muted">Showing results for</span>
              <h1 className="text-base sm:text-lg font-bold text-text-primary mt-0.5 break-words">
                {searchParam ? `Search: "${searchParam}"` : categoryParam ? `Category: ${categoryParam}` : 'All Catalog Products'}
                <span className="text-sm font-normal text-text-muted ml-2">({totalProducts} items)</span>
              </h1>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Mobile filter button */}
              <Button
                variant="secondary"
                icon={<SlidersHorizontal className="h-4 w-4" />}
                className="lg:hidden text-xs py-1.5 px-3 border border-dashboard-section-bg"
                onClick={() => setIsMobileFiltersOpen(true)}
              >
                Filters
              </Button>

              {/* Sort dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-medium hidden sm:inline">Sort:</span>
                <select
                  value={sortParam}
                  onChange={(e) => updateFilters('sort', e.target.value)}
                  className="text-xs border border-text-disabled rounded-input bg-surface px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="newest">Newest Arrivals</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating_desc">Top Customer Rated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Catalog products grids */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} variant="rect" className="h-80 w-full rounded-card" />
              ))}
            </div>
          ) : fetchFailed ? (
            <div className="py-16">
              <EmptyState
                icon={<WifiOff className="h-10 w-10 text-text-secondary" />}
                title="Couldn't load products"
                description="Check your internet connection and try again."
                actionLabel="Retry"
                onAction={retry}
              />
            </div>
          ) : products.length === 0 ? (
            <div className="py-16">
              <EmptyState
                icon={<SlidersHorizontal className="h-10 w-10 text-text-secondary" />}
                title="No products matched your criteria"
                description="Try adjusting your sliders, sorting selections, or search keywords."
                actionLabel="Reset Filters"
                onAction={handleClearFilters}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {products.map((prod) => (
                <ProductCard
                  key={prod._id}
                  product={prod}
                  onAddToCart={handleAddToCart}
                  onAddToWishlist={handleAddToWishlist}
                  isInWishlist={isInWishlist(prod._id)}
                  onQuickView={(p) => navigate(`/products/${p.slug}`)}
                />
              ))}
            </div>
          )}

          {/* Pagination bar */}
          {!isLoading && !fetchFailed && totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 py-8 border-t border-dashboard-section-bg mt-6 font-sans">
              <Button
                variant="secondary"
                disabled={pageParam === 1}
                onClick={() => updateFilters('page', (pageParam - 1).toString())}
                icon={<ChevronLeft className="h-4 w-4" />}
                className="p-2 border border-dashboard-section-bg"
              />
              <span className="text-xs text-text-secondary font-semibold select-none">
                Page {pageParam} of {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={pageParam === totalPages}
                onClick={() => updateFilters('page', (pageParam + 1).toString())}
                icon={<ChevronRight className="h-4 w-4" />}
                className="p-2 border border-dashboard-section-bg"
              />
            </div>
          )}
        </div>
      </div>

      {/* C. Mobile Filters Slide-in Panel Overlay */}
      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-text-primary/45 backdrop-blur-sm">
          <div className="w-4/5 max-w-sm bg-surface h-full flex flex-col shadow-level3 animate-slide-in">
            <div className="p-4 border-b border-dashboard-section-bg flex items-center justify-between">
              <h4 className="text-lg font-bold text-primary-dark">Refine Catalog</h4>
              <button
                onClick={() => setIsMobileFiltersOpen(false)}
                className="p-1 text-text-secondary hover:bg-dashboard-section-bg rounded-btn"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-grow overflow-y-auto p-6">
              {renderFiltersSidebar()}
            </div>
          </div>
          {/* Dismiss Click Area */}
          <div className="flex-grow" onClick={() => setIsMobileFiltersOpen(false)} />
        </div>
      )}
    </StorefrontLayout>
  );
};

export default ProductList;
