import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * Products are Markdown files, one per SKU. There is no database and no CMS —
 * `git push` is how you change the catalogue.
 *
 * Deliberately NOT stored here: price and stock counts. Shopee is the price of
 * record and changes it during promos; a static build would freeze a stale
 * number into the page and into our schema.org markup. `availability` is kept
 * deliberately coarse for the same reason.
 *
 * `scripts/sync-products.mjs` writes the marketplace-owned fields (sku, buyUrl,
 * availability) from a Shopee export. Everything else here is hand-written.
 */
const products = defineCollection({
  loader: glob({ base: './src/content/products', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // One line shown on the product card. Keep under ~90 chars.
      tagline: z.string(),
      sku: z.string(),
      // Direct link to this product's listing on the marketplace we sell
      // through. Falls back to SHOP_URL when omitted. Swapping to self-hosted
      // checkout later means putting a Stripe Payment Link here instead —
      // nothing else in the codebase has to change.
      buyUrl: z.url().optional(),
      availability: z
        .enum(['in-stock', 'preorder', 'sold-out'])
        .default('in-stock'),
      category: z.enum(['robots', 'kits', 'boards', 'parts']),
      // Drop a file in src/assets/ and reference it relatively to get
      // automatic resizing + webp. Optional so the catalogue builds without art.
      image: image().optional(),
      imageAlt: z.string().optional(),
      // Bullet points rendered above the long description.
      specs: z.array(z.string()).default([]),
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
      order: z.number().default(0),
    }),
});

/** Fields shared by DIY posts and guides. `heroImage` is added per-collection
 * because the image() helper only exists inside a schema function. */
const articleFields = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  author: z.string().default('Robotics Lab'),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
});

/** Long-form DIY build logs, listed newest first. */
const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.md' }),
  schema: ({ image }) =>
    articleFields.extend({ heroImage: image().optional() }),
});

/** Evergreen how-tos. Same shape as posts, listed alphabetically. */
const guides = defineCollection({
  loader: glob({ base: './src/content/guides', pattern: '**/*.md' }),
  schema: ({ image }) =>
    articleFields.extend({ heroImage: image().optional() }),
});

/**
 * Firmware builds offered for the boards we sell. This is a link directory,
 * not a file host: `flashUrl` points at a web flasher and `binUrl` at a .bin
 * download, both hosted wherever the firmware actually lives.
 */
const firmware = defineCollection({
  loader: glob({ base: './src/content/firmware', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      // Spoken trigger phrase, shown on the card.
      wakeword: z.string().optional(),
      // Both optional: a build with neither renders its buttons disabled
      // rather than linking nowhere.
      flashUrl: z.url().optional(),
      binUrl: z.url().optional(),
      // Slug of a product this firmware is for, e.g. esp32-s3-n16r8-...
      forProduct: z.string().optional(),
      image: image().optional(),
      imageAlt: z.string().optional(),
      order: z.number().default(0),
      draft: z.boolean().default(false),
    }),
});

export const collections = { products, posts, guides, firmware };
