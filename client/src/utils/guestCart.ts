// ─── Guest cart localStorage helpers ─────────────────────────────────────────
// Guests keep a full cart in localStorage under 'guest_cart' so they can shop
// before creating an account. The stored item shape mirrors what the Cart page
// renders and what POST /cart/merge consumes (productId, variantSku, quantity).

const GUEST_CART_KEY = 'guest_cart';

export interface GuestCartItem {
  productId: string;
  variantSku: string;
  quantity: number;
  name: string;
  brand?: string;
  slug: string;
  thumbnail: string;
  basePriceCents: number;
  priceDeltaCents: number;
  stock: number;
  color?: string;
  capacity?: string;
}

export const getGuestCartItems = (): GuestCartItem[] => {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
};

export const setGuestCartItems = (items: GuestCartItem[]) => {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify({ items }));
};

export const clearGuestCart = () => {
  localStorage.removeItem(GUEST_CART_KEY);
};

export const getGuestCartCount = (): number =>
  getGuestCartItems().reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

/**
 * Add an item to the guest cart. A product+variant already present is left
 * untouched ('exists') — quantity is only changed from the Cart page.
 * Returns the status plus the new total item count.
 */
export const addToGuestCart = (
  item: Omit<GuestCartItem, 'quantity'>,
  quantity: number
): { status: 'added' | 'exists'; count: number } => {
  const items = getGuestCartItems();
  const idx = items.findIndex(
    (i) => i.productId === item.productId && i.variantSku === item.variantSku
  );

  let status: 'added' | 'exists';
  if (idx > -1) {
    status = 'exists';
  } else {
    if (item.stock < quantity) {
      throw new Error(`Insufficient stock. Only ${item.stock} items are available.`);
    }
    items.push({ ...item, quantity });
    setGuestCartItems(items);
    status = 'added';
  }

  return { status, count: items.reduce((sum, i) => sum + i.quantity, 0) };
};
