import mongoose, { Schema, Document } from 'mongoose';

export interface IVariant {
  sku: string;
  color?: string;
  size?: string;
  capacity?: string;
  stock: number;
  priceDeltaCents: number;
  costPriceCents: number;
  lowStockThreshold: number;
}

export interface IImage {
  url: string;
  publicId: string;
}

export interface IMeta {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogImage?: string;
  ogDescription?: string;
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  brand?: string;
  categoryId: mongoose.Types.ObjectId;
  basePriceCents: number;
  variants: IVariant[];
  images: IImage[];
  ratingAvg: number;
  reviewCount: number;
  isTrending: boolean;
  isMostSelling: boolean;
  searchKeywords: string[];
  meta: IMeta;
  createdAt: Date;
  updatedAt: Date;
}

const VariantSchema = new Schema<IVariant>({
  sku: { type: String, required: true, trim: true },
  color: { type: String, trim: true },
  size: { type: String, trim: true },
  capacity: { type: String, trim: true },
  stock: { type: Number, required: true, min: 0 },
  priceDeltaCents: { type: Number, required: true, default: 0 },
  costPriceCents: { type: Number, required: true, min: 0 },
  lowStockThreshold: { type: Number, required: true, default: 10 },
});

const ImageSchema = new Schema<IImage>({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
});

const MetaSchema = new Schema<IMeta>({
  title: { type: String, trim: true },
  description: { type: String, trim: true },
  ogTitle: { type: String, trim: true },
  ogImage: { type: String, trim: true },
  ogDescription: { type: String, trim: true },
});

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    description: { type: String, required: true },
    brand: { type: String, trim: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    basePriceCents: { type: Number, required: true, min: 0 },
    variants: [VariantSchema],
    images: [ImageSchema],
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    isTrending: { type: Boolean, default: false, required: true },
    isMostSelling: { type: Boolean, default: false, required: true },
    searchKeywords: [{ type: String, trim: true }],
    meta: { type: MetaSchema, default: {} },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: 'products',
  }
);

// Indexes
ProductSchema.index({ name: 'text', searchKeywords: 'text' });
ProductSchema.index({ categoryId: 1, basePriceCents: 1 });

// Virtual Population for Reviews
ProductSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'productId',
});

// Slugify helper
const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

// Pre-validate hook to ensure a slug exists
ProductSchema.pre('validate', function (next) {
  if (this.name && !this.slug) {
    this.slug = slugify(this.name);
  }
  next();
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
export default Product;
