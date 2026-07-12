// Central image-resolution so every surface (cards, detail page, cart) agrees
// on which image to show for a product.
//
// The server can run without real Cloudinary credentials (mock mode), in which
// case file uploads are stored as fake "mock-cloud" URLs that never resolve to
// a real image. We treat those — and any empty value — as unusable and fall
// through to the product's gallery images, so a broken variant photo can never
// hide a perfectly good product image.

export interface ImageRef {
  url?: string;
  publicId?: string;
}

export interface VariantLike {
  image?: ImageRef | null;
}

export interface ProductLike {
  images?: ImageRef[];
  variants?: VariantLike[];
}

/** True when a URL points at something a browser can actually render. */
export const isUsableImageUrl = (url?: string | null): boolean => {
  if (!url) return false;
  const u = url.trim();
  if (!u) return false;
  // Mock Cloudinary placeholders produced when Cloudinary is not configured.
  if (u.includes('res.cloudinary.com/mock')) return false;
  if (u.includes('/mock_img_')) return false;
  return /^(https?:\/\/|\/|data:)/i.test(u);
};

/** First usable gallery image url for a product, or '' if none. */
export const resolveGalleryImage = (product?: ProductLike | null): string => {
  const img = product?.images?.find((i) => isUsableImageUrl(i?.url));
  return img?.url?.trim() || '';
};

/**
 * The image to display for a product, optionally for a selected variant.
 * Precedence: usable variant photo → first usable gallery image → ''.
 */
export const resolveProductImage = (
  product?: ProductLike | null,
  variant?: VariantLike | null
): string => {
  const v = variant?.image?.url;
  if (isUsableImageUrl(v)) return v!.trim();
  return resolveGalleryImage(product);
};
