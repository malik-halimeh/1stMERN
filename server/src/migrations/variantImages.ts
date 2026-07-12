/**
 * Variant-image architecture migration.
 *
 * The catalog used to have two independent image systems: a standalone product
 * gallery (`product.images`) and one optional photo per variant
 * (`variant.image`). Variant images are now the ONLY image source, stored as
 * an ordered `variant.images` array (images[0] = the variant's default photo).
 *
 * This migration, per product:
 *   1. keeps each variant's legacy single `image` as the head of its new
 *      `images` array (already-migrated arrays pass through untouched);
 *   2. moves the legacy standalone gallery into the FIRST variant (appended
 *      after its own photo, deduplicated by URL) so no image is lost;
 *   3. drops unusable mock-Cloudinary placeholder URLs (produced when the
 *      server ran without real Cloudinary credentials — they never render);
 *   4. removes the legacy `product.images` and `variant.image` fields.
 *
 * It runs against the raw collection (the Mongoose schema no longer knows the
 * legacy fields), is idempotent, and only touches documents that still carry
 * legacy data — so calling it on every server start is cheap and safe.
 */
import mongoose from 'mongoose';

interface LegacyImage {
  url?: string;
  publicId?: string;
}

// Mock placeholders never resolve to a real image — dropping them self-heals
// data written while Cloudinary ran in mock mode.
const isUsable = (url?: string): boolean =>
  typeof url === 'string' &&
  !!url.trim() &&
  !/res\.cloudinary\.com\/mock|\/mock_img_/i.test(url);

const clean = (img: LegacyImage): { url: string; publicId: string } => ({
  url: String(img.url).trim(),
  publicId: img.publicId || 'external',
});

export const migrateVariantImages = async (): Promise<number> => {
  const col = mongoose.connection.db!.collection('products');

  const legacyDocs = await col
    .find({
      $or: [{ images: { $exists: true } }, { 'variants.image': { $exists: true } }],
    })
    .toArray();

  for (const doc of legacyDocs) {
    const variants: any[] = Array.isArray(doc.variants) ? doc.variants : [];
    const galleryImages: LegacyImage[] = (Array.isArray(doc.images) ? doc.images : []).filter(
      (img: LegacyImage) => isUsable(img?.url)
    );

    for (const v of variants) {
      const images: { url: string; publicId: string }[] = Array.isArray(v.images)
        ? v.images.filter((img: LegacyImage) => isUsable(img?.url)).map(clean)
        : [];
      // The variant's legacy single photo stays first — it was the image the
      // admin explicitly chose for this variant.
      if (v.image && isUsable(v.image.url) && !images.some((img) => img.url === v.image.url.trim())) {
        images.unshift(clean(v.image));
      }
      v.images = images;
      delete v.image;
    }

    // The standalone gallery becomes part of the first variant so every
    // legacy image keeps rendering (product cards show the first image of
    // the first variant).
    if (variants.length > 0 && galleryImages.length > 0) {
      const first = variants[0];
      for (const img of galleryImages) {
        const cleaned = clean(img);
        if (!first.images.some((existing: LegacyImage) => existing.url === cleaned.url)) {
          first.images.push(cleaned);
        }
      }
    }

    await col.updateOne({ _id: doc._id }, { $set: { variants }, $unset: { images: '' } });
  }

  return legacyDocs.length;
};

export default migrateVariantImages;
