import React, { useState } from 'react';
import { ShoppingCart, Heart, Eye, Star } from 'lucide-react';
import Button from './Button.js';
import Badge from './Badge.js';
import type { BadgeVariant } from './Badge.js';

export interface ProductVariant {
  sku: string;
  color?: string;
  size?: string;
  capacity?: string;
  stock: number;
  priceDeltaCents: number;
  costPriceCents: number;
  lowStockThreshold: number;
  /** Optional variant-specific photo shown when the variant is selected */
  image?: { url: string; publicId: string };
}

export interface ProductDoc {
  _id: string;
  name: string;
  slug: string;
  description: string;
  brand?: string;
  categoryId: string;
  basePriceCents: number;
  variants: ProductVariant[];
  images: { url: string; publicId: string }[];
  ratingAvg: number;
  reviewCount: number;
  isTrending: boolean;
  isMostSelling: boolean;
  searchKeywords?: string[];
}

interface ProductCardProps {
  product: ProductDoc;
  onAddToCart?: (productId: string, variantSku: string) => void;
  onAddToWishlist?: (productId: string) => void;
  onQuickView?: (product: ProductDoc) => void;
  isInWishlist?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onAddToWishlist,
  onQuickView,
  isInWishlist = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Use the first variant as the default showcase
  const defaultVariant = product.variants?.[0];
  const currentPriceCents = product.basePriceCents + (defaultVariant?.priceDeltaCents || 0);
  const wasPriceCents = defaultVariant?.priceDeltaCents < 0 ? product.basePriceCents : null;

  const currentPrice = (currentPriceCents / 100).toFixed(2);
  const wasPrice = wasPriceCents ? (wasPriceCents / 100).toFixed(2) : null;

  // Stock status
  const totalStock = product.variants?.reduce((sum, v) => sum + v.stock, 0) || 0;
  let stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' = 'In Stock';
  let badgeVar: BadgeVariant = 'success';

  if (totalStock === 0) {
    stockStatus = 'Out of Stock';
    badgeVar = 'danger';
  } else if (totalStock < 10) {
    stockStatus = 'Low Stock';
    badgeVar = 'warning';
  }

  // Calculate discount percentage if price delta is negative
  const discountPercent = wasPriceCents
    ? Math.round(((wasPriceCents - currentPriceCents) / wasPriceCents) * 100)
    : null;

  return (
    <div
      className="bg-surface rounded-card border border-dashboard-section-bg/50 shadow-level1 flex flex-col overflow-hidden group hover:shadow-level2 transition-all duration-300 font-sans relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail/Image Area (60% card height) */}
      <div className="h-48 bg-dashboard-section-bg/30 relative flex items-center justify-center overflow-hidden">
        {product.images?.[0] ? (
          <img
            src={product.images[0].url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-display text-text-muted">🧊</span>
        )}

        {/* Action Overlays visible on Hover */}
        <div
          className={`absolute inset-0 bg-text-primary/20 backdrop-blur-[1px] flex items-center justify-center gap-2 transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {onQuickView && (
            <Button
              variant="secondary"
              onClick={() => onQuickView(product)}
              icon={<Eye className="h-4.5 w-4.5" />}
              className="bg-white/95 text-text-primary border-none hover:bg-white p-2.5 rounded-full shadow-level1"
              title="Quick View"
            />
          )}
          {onAddToWishlist && (
            <Button
              variant="secondary"
              onClick={() => onAddToWishlist(product._id)}
              icon={
                <Heart
                  className={`h-4.5 w-4.5 transition-colors ${
                    isInWishlist ? 'fill-danger text-danger' : 'text-text-secondary'
                  }`}
                />
              }
              className="bg-white/95 border-none hover:bg-white p-2.5 rounded-full shadow-level1"
              title="Add to Wishlist"
            />
          )}
        </div>

        {/* Floating Promotion Badge */}
        {discountPercent && (
          <span className="absolute top-3 left-3 bg-accent text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
            -{discountPercent}% OFF
          </span>
        )}

        {/* Floating Stock status Badge */}
        <Badge variant={badgeVar} className="absolute top-3 right-3 text-[10px]">
          {stockStatus}
        </Badge>
      </div>

      {/* Info Content Area */}
      <div className="p-4 flex flex-col gap-2 flex-grow">
        {product.brand && (
          <span className="text-caption text-text-muted font-semibold uppercase tracking-wider leading-none">
            {product.brand}
          </span>
        )}

        <h4 className="text-sm font-semibold text-text-primary line-clamp-2 min-h-[40px] leading-tight">
          {product.name}
        </h4>

        {/* Ratings block */}
        <div className="flex items-center gap-1">
          <div className="flex text-amber-400">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Star
                key={idx}
                className={`h-3.5 w-3.5 ${
                  idx < Math.round(product.ratingAvg || 0)
                    ? 'fill-current'
                    : 'text-text-disabled'
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] text-text-muted font-medium">({product.reviewCount || 0})</span>
        </div>

        {/* Prices Row */}
        <div className="flex items-baseline gap-2 mt-1 select-none">
          <span className="text-secondary font-bold text-primary">${currentPrice}</span>
          {wasPrice && (
            <span className="text-xs text-text-muted line-through">${wasPrice}</span>
          )}
        </div>

        {/* Add to Cart button */}
        {onAddToCart && defaultVariant && (
          <Button
            variant="primary"
            disabled={totalStock === 0}
            onClick={() => onAddToCart(product._id, defaultVariant.sku)}
            icon={<ShoppingCart className="h-4 w-4" />}
            className="w-full mt-2 text-xs py-1.5 gap-1.5"
          >
            {totalStock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
