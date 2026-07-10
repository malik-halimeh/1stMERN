import api from '../services/api.js';
import { getGuestWishlist, clearGuestWishlist } from '../pages/Wishlist.js';

type Toast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;

/**
 * After any successful sign-in (password, verification code, or Google),
 * merge the guest localStorage cart and wishlist into the account.
 */
export const mergeGuestData = async (addToast: Toast) => {
  // Cart merge-on-login logic
  const guestCartStored = localStorage.getItem('guest_cart');
  if (guestCartStored) {
    try {
      const parsed = JSON.parse(guestCartStored);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        await api.post('/cart/merge', { items: parsed.items });
        addToast('Synchronized guest cart with your account.', 'success');
      }
    } catch (mergeErr) {
      console.error('Guest cart merge failed:', mergeErr);
    } finally {
      localStorage.removeItem('guest_cart');
    }
  }

  // Wishlist merge-on-login logic
  const guestWishlist = getGuestWishlist();
  if (guestWishlist && guestWishlist.length > 0) {
    try {
      await api.post('/wishlist/merge', { productIds: guestWishlist });
      addToast('Synchronized guest wishlist with your account.', 'success');
    } catch (mergeErr) {
      console.error('Guest wishlist merge failed:', mergeErr);
    } finally {
      clearGuestWishlist();
    }
  }
};
