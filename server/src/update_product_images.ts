/**
 * One-off utility: replace placeholder product images with real appliance
 * photos IN PLACE — unlike `npm run seed` this does NOT drop any data, so
 * existing users/orders/reviews survive.
 *
 * Run with:  npx tsx src/update_product_images.ts   (from server/)
 *
 * Every URL below was HEAD-verified (HTTP 200) against the Unsplash CDN
 * before being added here. Products whose slug isn't in the map are listed
 * so they can be given photos through the admin panel.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Product from './models/Product.js';

const photo = (id: string, tag: string) => ({
  url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`,
  publicId: `unsplash_${tag}`,
});

// slug → gallery images (matches seed.ts)
const IMAGE_MAP: Record<string, { url: string; publicId: string }[]> = {
  'opticool-frostfree-500l': [
    photo('1571175443880-49e1d25b2bc5', 'frostfree_500l'),
    photo('1721613877687-c9099b698faa', 'frostfree_500l_side'),
  ],
  'opticool-compact-200l': [
    photo('1536353284924-9220c464e262', 'compact_200l'),
    photo('1606859191214-25806e8e2423', 'compact_200l_side'),
  ],
  'opticool-french-door-650l': [
    photo('1722859178634-ccc8ea5680d2', 'french_door_650l'),
    photo('1710947949965-8150d227d337', 'french_door_650l_side'),
  ],
  'opticool-side-by-side-580l': [
    photo('1630459065645-549fe5a56db4', 'side_by_side_580l'),
    photo('1643494847705-74808059bf07', 'side_by_side_580l_side'),
  ],
  'opticool-quietzone-320l': [
    photo('1721563927724-74b1a0ddef33', 'quietzone_320l'),
    photo('1484154218962-a197022b5858', 'quietzone_320l_side'),
  ],
  'opticool-wine-cellar-120': [
    photo('1728177196098-ef48bfb63832', 'wine_cellar_120'),
    photo('1620431858899-f5ac9f3f6f36', 'wine_cellar_120_side'),
  ],
  'optichef-convecpro-60cm': [
    photo('1596552183299-000ef779e88d', 'convecpro_oven'),
    photo('1623114112815-74a4b9fe505d', 'convecpro_oven_side'),
  ],
  'optichef-inductaflame-4zone': [
    photo('1600512592336-7e1452b9743c', 'inductaflame_cooktop'),
    photo('1622413472825-0857e054ea39', 'inductaflame_cooktop_side'),
  ],
  'optichef-microwave-pro-32l': [
    photo('1574269909862-7e1d70bb8078', 'microwave_pro_32l'),
    photo('1585659722983-3a675dabf23d', 'microwave_pro_32l_side'),
  ],
  'optichef-airfryer-max-8l': [
    photo('1695089028114-ce28248f0ab9', 'airfryer_max_8l'),
    photo('1621955293419-2655068eee84', 'airfryer_max_8l_side'),
  ],
  'optichef-steambake-45cm': [
    photo('1628797292362-1f382b2f4b5d', 'steambake_45cm'),
    photo('1599083549933-838ea352c1cc', 'steambake_45cm_side'),
  ],
  'optichef-dishwasher-slimline-45cm': [
    photo('1581622558663-b2e33377dfb2', 'dishwasher_slimline'),
    photo('1620568400263-6f1cf95b9e30', 'dishwasher_slimline_side'),
  ],
};

async function run() {
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    await new Promise<void>((resolve) => mongoose.connection.once('connected', () => resolve()));
  }

  let updated = 0;
  for (const [slug, gallery] of Object.entries(IMAGE_MAP)) {
    const product = await Product.findOne({ slug });
    if (!product) {
      console.log(`- ${slug} — not found in DB (skipped)`);
      continue;
    }
    // Images live on variants: every variant gets the full photo set with
    // "its own" photo first (mirrors seed.ts), so variants show distinct
    // default images and the first variant's first image is the card image.
    product.variants.forEach((v, i) => {
      const own = gallery[i % gallery.length];
      v.images = [own, ...gallery.filter((img) => img !== own)];
    });
    product.markModified('variants');
    await product.save();
    updated++;
    console.log(`✓ ${slug} — ${gallery.length} photos set on ${product.variants.length} variant(s)`);
  }

  // Report products still on placeholders (created outside the seed)
  const remaining = await Product.find({
    $or: [
      { 'variants.0.images.0': { $exists: false } },
      { 'variants.0.images.0.url': { $regex: 'placehold\\.co|mock-cloud' } },
    ],
  }).select('name slug');
  if (remaining.length > 0) {
    console.log('\n⚠ Still without real photos (add via Admin → Products → Edit):');
    for (const p of remaining) console.log(`  - ${p.name} (${p.slug})`);
  }

  console.log(`\nDone. ${updated}/${Object.keys(IMAGE_MAP).length} products updated in place.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('✗ Failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
