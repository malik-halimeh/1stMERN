/**
 * Standalone runner for the variant-image migration.
 * Run with:  npm run migrate-images   (from the server/ folder)
 *
 * Moves the legacy standalone product gallery (`product.images`) and single
 * per-variant photo (`variant.image`) into the ordered `variant.images`
 * array — see src/migrations/variantImages.ts for the full strategy. The same
 * migration also runs automatically on server start, so this script is only
 * needed to migrate a database ahead of a deploy.
 *
 * Idempotent and non-destructive: only products still carrying legacy image
 * fields are touched; every other collection is left alone.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { migrateVariantImages } from '../src/migrations/variantImages.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/opticart';

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB:', MONGO_URI);

  const migrated = await migrateVariantImages();
  console.log(
    migrated === 0
      ? '✓ Nothing to migrate — all products already use variant images'
      : `✓ Migrated ${migrated} product(s) to variant images`
  );

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('✗ Migration failed:', err);
  process.exit(1);
});
