import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';
import { useAuth } from './AuthContext.js';
import { getGuestWishlist, addToGuestWishlist } from '../pages/Wishlist.js';
import { addToGuestCart, getGuestCartCount } from '../utils/guestCart.js';

// Shared storefront state: live cart item count (header badge) and the set of
// wishlisted product ids, so every Add-to-Cart / Add-to-Wishlist button on any
// page stays consistent — no more "added!" toasts for items already saved.

interface ShopContextType {
  /** Total quantity of items in the cart (shown on the header badge) */
  cartCount: number;
  wishlistIds: string[];
  isInWishlist: (productId: string) => boolean;
  /**
   * Adds to cart — server cart when signed in, localStorage for guests.
   * Resolves 'added' for a new row, 'exists' when the product was already
   * in the cart (nothing changes; quantity is edited on the Cart page).
   */
  addItemToCart: (productId: string, variantSku: string, quantity?: number) => Promise<'added' | 'exists'>;
  /** Adds to wishlist — 'exists' when the item was already saved */
  addItemToWishlist: (productId: string) => Promise<'added' | 'exists'>;
  /** Sync helpers for pages that mutate cart/wishlist through their own calls */
  setCartCount: React.Dispatch<React.SetStateAction<number>>;
  removeWishlistId: (productId: string) => void;
  refreshShopData: () => Promise<void>;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

const sumQuantities = (items: Array<{ quantity?: number }> | undefined): number =>
  (items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);


export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  // (Re)load counts whenever the session changes: server data when signed in,
  // localStorage for guests.
  const refreshShopData = useCallback(async () => {
    if (user) {
      const [cartRes, wishRes] = await Promise.allSettled([api.get('/cart'), api.get('/wishlist')]);
      if (cartRes.status === 'fulfilled' && cartRes.value.data?.success) {
        setCartCount(sumQuantities(cartRes.value.data.data.items));
      }
      if (wishRes.status === 'fulfilled' && wishRes.value.data?.success) {
        const items = wishRes.value.data.data.items || [];
        setWishlistIds(items.map((p: any) => String(p._id)));
      }
    } else {
      setCartCount(getGuestCartCount());
      setWishlistIds(getGuestWishlist());
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading) refreshShopData();
  }, [isLoading, refreshShopData]);

  const isInWishlist = useCallback(
    (productId: string) => wishlistIds.includes(productId),
    [wishlistIds]
  );

  const addItemToCart = useCallback(
    async (productId: string, variantSku: string, quantity = 1): Promise<'added' | 'exists'> => {
      if (!user) {
        // Guest: snapshot the product details into localStorage so the Cart
        // page can render it and /cart/merge can absorb it after login.
        const res = await api.get(`/products/by-ids?ids=${productId}`);
        const product = (res.data?.data || [])[0];
        if (!product) throw new Error('Product not found.');
        const variant = (product.variants || []).find((v: any) => v.sku === variantSku);
        if (!variant) throw new Error('Product variant not found.');

        const { status, count } = addToGuestCart(
          {
            productId,
            variantSku,
            name: product.name,
            brand: product.brand,
            slug: product.slug,
            thumbnail: product.thumbnail || product.images?.[0]?.url || '',
            basePriceCents: product.basePriceCents,
            priceDeltaCents: variant.priceDeltaCents || 0,
            stock: variant.stock ?? 0,
            color: variant.color,
            capacity: variant.capacity,
          },
          quantity
        );
        setCartCount(count);
        return status;
      }

      const res = await api.post('/cart/items', { productId, variantSku, quantity });
      setCartCount(sumQuantities(res.data?.data?.items));
      return res.data?.alreadyInCart ? 'exists' : 'added';
    },
    [user]
  );

  const addItemToWishlist = useCallback(
    async (productId: string): Promise<'added' | 'exists'> => {
      if (wishlistIds.includes(productId)) {
        return 'exists';
      }
      if (!user) {
        const added = addToGuestWishlist(productId);
        if (added) setWishlistIds((prev) => [...prev, productId]);
        return added ? 'added' : 'exists';
      }
      const res = await api.post(`/wishlist/${productId}`);
      setWishlistIds((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
      // Another tab/session may have saved it first — trust the server's verdict
      return res.data?.alreadyInWishlist ? 'exists' : 'added';
    },
    [user, wishlistIds]
  );

  const removeWishlistId = useCallback((productId: string) => {
    setWishlistIds((prev) => prev.filter((id) => id !== productId));
  }, []);

  return (
    <ShopContext.Provider
      value={{
        cartCount,
        wishlistIds,
        isInWishlist,
        addItemToCart,
        addItemToWishlist,
        setCartCount,
        removeWishlistId,
        refreshShopData,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = (): ShopContextType => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
