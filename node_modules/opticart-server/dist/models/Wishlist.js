import mongoose, { Schema } from 'mongoose';
const WishlistSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    productIds: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Product',
        },
    ],
}, {
    timestamps: true,
    collection: 'wishlists',
});
export const Wishlist = mongoose.model('Wishlist', WishlistSchema);
export default Wishlist;
