/**
 * Non-destructive product media backfill.
 * Run with:  npm run update-media   (from the server/ folder)
 *
 * For every product ALREADY in the database:
 *   - if it has 2+ variants, give each variant its own photo (reusing the
 *     product's own usable gallery images) so the variant selector shows
 *     distinct images;
 *   - if it has a single variant, clear any stray/mock variant image so the
 *     product gallery is the single source of truth.
 *
 * Orders, users, reviews, coupons and every other collection are left
 * untouched — this only rewrites each product's variant `image` fields, so it
 * is safe to run against the live (deployed) database.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Product from '../src/models/Product.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/opticart';

// Mock Cloudinary placeholders (created when Cloudinary is not configured)
// never resolve to a real image, so we treat them as unusable.
const isUsable = (u?: string) => !!u && !/res\.cloudinary\.com\/mock|\/mock_img_/i.test(u);

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB:', MONGO_URI);

  const products = await Product.find();
  let changed = 0;

  for (const prod of products) {
    const gallery = prod.images.filter((img) => isUsable(img?.url));

    if (prod.variants.length >= 2 && gallery.length > 0) {
      prod.variants.forEach((v, i) => {
        const src = gallery[i % gallery.length];
        v.image = { url: src.url, publicId: src.publicId } as any;
      });
    } else {
      // Single variant (or no usable gallery): drop any stray/mock variant image
      prod.variants.forEach((v) => {
        v.image = undefined as any;
      });
    }

    prod.markModified('variants');
    await prod.save();
    changed++;
    console.log(`  • ${prod.name} — ${prod.variants.length} variant(s)`);
  }

  console.log(`✓ Updated media on ${changed} products`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('✗ Update failed:', err);
  process.exit(1);
});
