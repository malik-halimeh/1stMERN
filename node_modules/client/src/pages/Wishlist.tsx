import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Trash2, ShoppingCart, Trash } from 'lucide-react';
import StorefrontLayout from '../components/layout/StorefrontLayout.js';
import ProductCard from '../components/ui/ProductCard.js';
import Skeleton from '../components/ui/Skeleton.js';
import Button from '../components/ui/Button.js';
import EmptyState from '../components/ui/EmptyState.js';
import { useToast } from '../context/ToastContext.js';
import api from '../services/api.js';

interface WishlistItem {
  _id: string;
  name: string;
  brand?: string;
  slug: string;
  thumbnail: string;
  basePriceCents: number;
  ratingAvg?: number;
  variants: Array<{
    sku: string;
    color?: string;
    capacity?: string;
    stock: number;
    priceDeltaCents: number;
  }>;
}

const Wishlist: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWishlist = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/wishlist');
      if (res.data?.success) {
        setItems(res.data.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load wishlist:', err);
      addToast('Could not fetch wishlist items.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  const handleRemove = async (productId: string) => {
    try {
      const res = await api.delete(`/wishlist/items/${productId}`);
      if (res.data?.success) {
        setItems(items.filter((item) => item._id !== productId));
        addToast('Item removed from wishlist.', 'success');
      }
    } catch (err) {
      addToast('Failed to remove item.', 'error');
    }
  };

  const handleMoveToCart = async (productId: string, variantSku: string) => {
    try {
      const res = await api.post('/cart/items', { productId, variantSku, quantity: 1 });
      if (res.data?.success) {
        addToast('Product added to shopping cart.', 'success');
        await handleRemove(productId);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Could not move item to cart.';
      addToast(msg, 'error');
    }
  };

  return (
    <StorefrontLayout breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'My Wishlist' }]}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
        <h1 className="text-3xl font-bold text-text-primary text-left mb-8 flex items-center gap-2">
          <Heart className="h-7 w-7 text-danger fill-current" /> My Wishlist
        </h1>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-80 w-full rounded-card" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={<Heart className="h-12 w-12 text-text-secondary animate-pulse" />}
              title="Your Wishlist is Empty"
              description="Explore our premium appliances and click the heart icon on any product to save it here for later."
              actionLabel="Explore Products"
              onAction={() => navigate('/products')}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {items.map((item) => {
              const firstVariant = item.variants?.[0] || { sku: '', stock: 0, priceDeltaCents: 0 };
              
              // Standardize ProductDoc compatibility for ProductCard
              const standardizedProduct = {
                _id: item._id,
                name: item.name,
                brand: item.brand,
                slug: item.slug,
                description: '',
                thumbnail: item.thumbnail,
                basePriceCents: item.basePriceCents,
                ratingAvg: item.ratingAvg || 5,
                variants: item.variants,
                createdAt: '',
                updatedAt: '',
              };

              return (
                <div key={item._id} className="relative group">
                  <ProductCard
                    product={standardizedProduct}
                    onAddToCart={() => handleMoveToCart(item._id, firstVariant.sku)}
                    onAddToWishlist={() => handleRemove(item._id)}
                    onQuickView={(p) => navigate(`/products/${p.slug}`)}
                  />
                  {/* Overlay Remove button */}
                  <button
                    onClick={() => handleRemove(item._id)}
                    className="absolute top-3 left-3 bg-surface hover:bg-danger-bg/20 text-text-muted hover:text-danger p-2 rounded-full border border-dashboard-section-bg/50 shadow-level1 transition-all focus:outline-none"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
};

export default Wishlist;
