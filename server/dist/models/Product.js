import mongoose, { Schema } from 'mongoose';
const ImageSchema = new Schema({
    url: { type: String, required: true },
    publicId: { type: String, required: true },
});
const VariantSchema = new Schema({
    sku: { type: String, required: true, trim: true },
    color: { type: String, trim: true },
    size: { type: String, trim: true },
    capacity: { type: String, trim: true },
    stock: { type: Number, required: true, min: 0 },
    priceDeltaCents: { type: Number, required: true, default: 0 },
    costPriceCents: { type: Number, required: true, min: 0 },
    lowStockThreshold: { type: Number, required: true, default: 10 },
    images: { type: [ImageSchema], default: [] },
});
const MetaSchema = new Schema({
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    ogTitle: { type: String, trim: true },
    ogImage: { type: String, trim: true },
    ogDescription: { type: String, trim: true },
});
const ProductSchema = new Schema({
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
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    isTrending: { type: Boolean, default: false, required: true },
    isMostSelling: { type: Boolean, default: false, required: true },
    searchKeywords: [{ type: String, trim: true }],
    meta: { type: MetaSchema, default: {} },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: 'products',
});
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
const slugify = (text) => {
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
export const Product = mongoose.model('Product', ProductSchema);
export default Product;
