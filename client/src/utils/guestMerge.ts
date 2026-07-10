import api from '../services/api.js';
import { getGuestWishlist, clearGuestWishlist } from '../pages/Wishlist.js';
import { getGuestCartItems, clearGuestCart } from './guestCart.js';

type Toast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;

/**
 * After any successful sign-in (password, verification code, or Google),
 * merge the guest localStorage cart and wishlist into the account.
 */
export const mergeGuestData = async (addToast: Toast) => {
  // Cart merge-on-login logic
  const guestCartItems = getGuestCartItems();
  if (guestCartItems.length > 0) {
    try {
      await api.post('/cart/merge', { items: guestCartItems });
      addToast('Synchronized guest cart with your account.', 'success');
    } catch (mergeErr) {
      console.error('Guest cart merge failed:', mergeErr);
    } finally {
      clearGuestCart();
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
