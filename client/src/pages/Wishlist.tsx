import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Trash2, X, LogIn, UserPlus } from 'lucide-react';
import StorefrontLayout from '../components/layout/StorefrontLayout.js';
import ProductCard from '../components/ui/ProductCard.js';
import Skeleton from '../components/ui/Skeleton.js';
import Button from '../components/ui/Button.js';
import EmptyState from '../components/ui/EmptyState.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { useShop } from '../context/ShopContext.js';
import api from '../services/api.js';

// ─── localStorage helpers ────────────────────────────────────────────────────
const GUEST_WISHLIST_KEY = 'guest_wishlist';

export const getGuestWishlist = (): string[] => {
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const setGuestWishlist = (ids: string[]) => {
  localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(ids));
};

export const addToGuestWishlist = (productId: string): boolean => {
  const current = getGuestWishlist();
  if (current.includes(productId)) return false; // already in list
  setGuestWishlist([...current, productId]);
  return true;
};

export const removeFromGuestWishlist = (productId: string) => {
  setGuestWishlist(getGuestWishlist().filter((id) => id !== productId));
};

export const clearGuestWishlist = () => {
  localStorage.removeItem(GUEST_WISHLIST_KEY);
};
// ─────────────────────────────────────────────────────────────────────────────

interface WishlistItem {
  _id: string;
  name: string;
  brand?: string;
  slug: string;
  thumbnail: string;
  basePriceCents: number;
  ratingAvg?: number;
  reviewCount?: number;
  variants: Array<{
    sku: string;
    color?: string;
    capacity?: string;
    stock: number;
    priceDeltaCents: number;
    costPriceCents?: number;
    lowStockThreshold?: number;
  }>;
  images?: { url: string; publicId: string }[];
}

const Wishlist: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { addItemToCart, removeWishlistId } = useShop();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ── Fetch items ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        if (user) {
          // Authenticated: pull from DB
          const res = await api.get('/wishlist');
          if (res.data?.success) {
            setItems(res.data.data.items || []);
          }
        } else {
          // Guest: read IDs from localStorage, batch-fetch product details
          const ids = getGuestWishlist();
          if (ids.length === 0) {
            setItems([]);
          } else {
            const res = await api.get(`/products/by-ids?ids=${ids.join(',')}`);
            if (res.data?.success) {
              setItems(res.data.data);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load wishlist:', err);
        addToast('Could not load wishlist items.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user]);

  // ── Remove handler — also syncs the shared wishlist badge ──────────────────
  const handleRemove = async (productId: string) => {
    if (user) {
      try {
        const res = await api.delete(`/wishlist/${productId}`);
        if (res.data?.success) {
          setItems((prev) => prev.filter((i) => i._id !== productId));
          removeWishlistId(productId);
          addToast('Item removed from wishlist.', 'success');
        }
      } catch {
        addToast('Failed to remove item.', 'error');
      }
    } else {
      removeFromGuestWishlist(productId);
      setItems((prev) => prev.filter((i) => i._id !== productId));
      removeWishlistId(productId);
      addToast('Item removed from wishlist.', 'success');
    }
  };

  // ── Move to cart — updates the shared cart badge (guest + auth) ────────────
  const handleMoveToCart = async (productId: string, variantSku: string) => {
    try {
      const status = await addItemToCart(productId, variantSku, 1);
      if (status === 'exists') {
        addToast('This product is already in your cart.', 'info');
      } else {
        addToast('Product added to cart.', 'success');
      }
      await handleRemove(productId);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err?.message || 'Could not move item to cart.';
      addToast(msg, 'error');
    }
  };

  // ── Guest sign-in banner ───────────────────────────────────────────────────
  const GuestBanner = () => {
    if (user || bannerDismissed) return null;
    return (
      <div className="relative mb-6 bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-scale-in">
        <div className="flex items-start gap-3">
          <Heart className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-text-primary">Save your wishlist across devices</p>
            <p className="text-xs text-text-secondary mt-0.5">
              Sign in or create a free account to keep your wishlist synced everywhere.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <Link to="/login?redirect=/wishlist">
            <Button variant="primary" icon={<LogIn className="h-4 w-4" />} className="text-xs py-1.5 px-3">
              Sign In
            </Button>
          </Link>
          <Link to="/register">
            <Button variant="secondary" icon={<UserPlus className="h-4 w-4" />} className="text-xs py-1.5 px-3">
              Register
            </Button>
          </Link>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="p-1 text-text-muted hover:text-text-primary transition-colors rounded-full"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <StorefrontLayout breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'My Wishlist' }]}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
        <h1 className="text-3xl font-bold text-text-primary text-left mb-6 flex items-center gap-2">
          <Heart className="h-7 w-7 text-danger fill-current" /> My Wishlist
        </h1>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-80 w-full rounded-card" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12">
            {!user && <GuestBanner />}
            <EmptyState
              icon={<Heart className="h-12 w-12 text-text-secondary animate-pulse" />}
              title="Your Wishlist is Empty"
              description="Explore our premium appliances and click the heart icon on any product to save it here for later."
              actionLabel="Browse Products"
              onAction={() => navigate('/products')}
            />
          </div>
        ) : (
          <>
            <GuestBanner />
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {items.map((item) => {
                const firstVariant = item.variants?.[0] || { sku: '', stock: 0, priceDeltaCents: 0, costPriceCents: 0, lowStockThreshold: 5 };

                // Normalise to ProductDoc shape expected by ProductCard
                const standardizedProduct = {
                  _id: item._id,
                  name: item.name,
                  brand: item.brand,
                  slug: item.slug,
                  description: '',
                  thumbnail: item.thumbnail,
                  basePriceCents: item.basePriceCents,
                  ratingAvg: item.ratingAvg || 0,
                  reviewCount: item.reviewCount || 0,
                  variants: item.variants.map((v) => ({
                    ...v,
                    costPriceCents: v.costPriceCents ?? 0,
                    lowStockThreshold: v.lowStockThreshold ?? 5,
                  })),
                  images: item.images || [],
                  categoryId: '',
                  isTrending: false,
                  isMostSelling: false,
                  createdAt: '',
                  updatedAt: '',
                };

                return (
                  <div key={item._id} className="relative group">
                    <ProductCard
                      product={standardizedProduct}
                      onAddToCart={() => handleMoveToCart(item._id, firstVariant.sku)}
                      onAddToWishlist={() => handleRemove(item._id)}
                      isInWishlist={true}
                      onQuickView={(p) => navigate(`/products/${p.slug}`)}
                    />
                    {/* Overlay remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemove(item._id)}
                      className="absolute top-3 left-3 bg-surface hover:bg-danger-bg/20 text-text-muted hover:text-danger p-2 rounded-full border border-dashboard-section-bg/50 shadow-level1 transition-all focus:outline-none"
                      title="Remove from wishlist"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </StorefrontLayout>
  );
};

export default Wishlist;
