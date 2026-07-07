import mongoose, { Schema } from 'mongoose';
const CartItemSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    variantSku: {
        type: String,
        required: true,
        trim: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity must be at least 1.'],
    },
    priceAtAddCents: {
        type: Number,
        required: true,
        min: [0, 'Price must be non-negative.'],
    },
});
const CartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    items: [CartItemSchema],
}, {
    timestamps: true,
    collection: 'carts',
});
export const Cart = mongoose.model('Cart', CartSchema);
export default Cart;
