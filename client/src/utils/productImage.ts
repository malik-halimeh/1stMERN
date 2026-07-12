// Central image resolution so every surface (cards, search, detail page,
// cart, wishlist) agrees on which image to show for a product.
//
// Variant images are the ONLY image source: each variant carries an ordered
// `images` array (images[0] = its default photo) and the product's card image
// everywhere is the first image of the first variant.
//
// The server can run without real Cloudinary credentials (mock mode), in
// which case file uploads are stored as fake "mock-cloud" URLs that never
// resolve to a real image. We treat those — and any empty value — as unusable
// and skip past them, so a broken photo can never hide a working one.
//
// Legacy shapes (`product.images` gallery, single `variant.image`) are still
// read as a LAST-RESORT fallback because snapshots of the old shape live in
// customers' localStorage (recently-viewed lists, guest carts). The server no
// longer produces them.

export interface ImageRef {
  url?: string;
  publicId?: string;
}

export interface VariantLike {
  images?: ImageRef[];
  /** Legacy single photo — only present in stale localStorage snapshots */
  image?: ImageRef | null;
}

export interface ProductLike {
  variants?: VariantLike[];
  /** Legacy standalone gallery — only present in stale localStorage snapshots */
  images?: ImageRef[];
}

/** One flattened gallery entry: an image plus the variant it belongs to. */
export interface GalleryEntry {
  url: string;
  /** Index of the owning variant in product.variants */
  variantIndex: number;
  /** Position of this image within its variant (admin-defined order) */
  imageIndex: number;
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

/** A variant's usable images in admin-defined order. */
export const usableVariantImages = (variant?: VariantLike | null): ImageRef[] => {
  const list = variant?.images?.filter((img) => isUsableImageUrl(img?.url)) || [];
  // Legacy single-photo fallback for stale localStorage snapshots
  if (list.length === 0 && isUsableImageUrl(variant?.image?.url)) {
    return [variant!.image!];
  }
  return list;
};

/**
 * The product's default image: first usable image of the FIRST variant.
 * Falls back to later variants, then to the legacy standalone gallery
 * (stale localStorage data only), then ''.
 */
export const resolveGalleryImage = (product?: ProductLike | null): string => {
  for (const variant of product?.variants || []) {
    const img = usableVariantImages(variant)[0];
    if (img?.url) return img.url.trim();
  }
  const legacy = product?.images?.find((img) => isUsableImageUrl(img?.url));
  return legacy?.url?.trim() || '';
};

/**
 * The image to display for a product, optionally for a selected variant.
 * Precedence: selected variant's first usable image → product default.
 */
export const resolveProductImage = (
  product?: ProductLike | null,
  variant?: VariantLike | null
): string => {
  const img = usableVariantImages(variant)[0];
  if (img?.url) return img.url.trim();
  return resolveGalleryImage(product);
};

/**
 * Flattens every variant's images into one continuous, ordered gallery
 * (variant order, then admin-defined image order within each variant).
 * Each entry remembers its owning variant so the detail page can keep the
 * gallery and the variant selector bidirectionally in sync.
 */
export const flattenVariantGallery = (product?: ProductLike | null): GalleryEntry[] => {
  const entries: GalleryEntry[] = [];
  (product?.variants || []).forEach((variant, variantIndex) => {
    usableVariantImages(variant).forEach((img, imageIndex) => {
      entries.push({ url: img.url!.trim(), variantIndex, imageIndex });
    });
  });
  return entries;
};
