import mongoose, { Schema } from 'mongoose';
const CategorySchema = new Schema({
    name: { type: String, required: true, trim: true },
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
    },
    parentId: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        default: null,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false }, // Only record createdAt per prompt
    collection: 'categories',
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
CategorySchema.pre('validate', function (next) {
    if (this.name && !this.slug) {
        this.slug = slugify(this.name);
    }
    next();
});
export const Category = mongoose.model('Category', CategorySchema);
export default Category;
