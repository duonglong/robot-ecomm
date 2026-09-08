#!/usr/bin/env node
/**
 * Wire your own product photos into the catalogue.
 *
 * Point it at a folder of images. Files are matched to products by SKU or by
 * slug (filename, case-insensitive, extension ignored), copied into
 * src/assets/products/ and written into the product's frontmatter.
 *
 * Photos of the item you actually ship are the only correct images here. A
 * stock photo of a different board variant is the most common cause of "hàng
 * không giống hình" complaints and returns.
 *
 * Usage:
 *   node scripts/import-images.mjs ~/photos              # dry run
 *   node scripts/import-images.mjs ~/photos --apply
 *
 * Naming: BRD-S3-TIM.jpg (SKU) or esp32-s3-mach-tim.jpg (slug). Both work.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync, mkdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const PRODUCT_DIR = 'src/content/products';
const ASSET_DIR = 'src/assets/products';
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

/** Big photos make Cloudflare builds slow and bloat the git history. */
const WARN_BYTES = 900 * 1024;

function splitFrontmatter(content) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(content);
  return match ? { yaml: match[1], body: content.slice(match[0].length) } : null;
}

function readField(yaml, key) {
  const m = new RegExp(`^${key}\\s*:\\s*(.+)$`, 'm').exec(yaml);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

/**
 * Quote anything YAML would misread. A Vietnamese alt line very often contains
 * ": " — leaving it bare produces "bad indentation of a mapping entry" and the
 * whole build fails.
 */
function yamlScalar(value) {
  const risky =
    value === '' ||
    /^[-?:,\[\]{}#&*!|>'"%@`]/.test(value) ||
    /:\s/.test(value) ||
    /\s#/.test(value) ||
    /^\s|\s$/.test(value);
  return risky ? JSON.stringify(value) : value;
}

function setField(yaml, key, value) {
  const lines = yaml.split('\n');
  const line = `${key}: ${yamlScalar(value)}`;
  const idx = lines.findIndex((l) => new RegExp(`^${key}\\s*:`).test(l));
  if (idx !== -1) {
    if (lines[idx] === line) return { yaml, changed: false };
    lines[idx] = line;
    return { yaml: lines.join('\n'), changed: true };
  }
  let anchor = -1;
  lines.forEach((l, i) => {
    if (/^(title|tagline|sku|order)\s*:/.test(l)) anchor = i;
  });
  lines.splice(anchor + 1, 0, line);
  return { yaml: lines.join('\n'), changed: true };
}

function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  const apply = args.includes('--apply');

  if (!dir || !existsSync(dir)) {
    console.error('Usage: node scripts/import-images.mjs <folder-of-photos> [--apply]');
    process.exit(1);
  }

  // Index products by slug and SKU.
  const products = readdirSync(PRODUCT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const content = readFileSync(join(PRODUCT_DIR, file), 'utf8');
      const fm = splitFrontmatter(content);
      return {
        file,
        slug: file.replace(/\.md$/, ''),
        sku: fm ? readField(fm.yaml, 'sku') : null,
        title: fm ? readField(fm.yaml, 'title') : null,
        image: fm ? readField(fm.yaml, 'image') : null,
        fm,
      };
    })
    .filter((p) => p.fm);

  const photos = readdirSync(dir).filter((f) => EXTS.has(extname(f).toLowerCase()));

  const plan = [];
  const unmatched = [];

  for (const photo of photos) {
    const stem = basename(photo, extname(photo)).toLowerCase();
    const match =
      products.find((p) => p.slug.toLowerCase() === stem) ??
      products.find((p) => p.sku && p.sku.toLowerCase() === stem) ??
      products.find((p) => p.sku && stem.includes(p.sku.toLowerCase()));

    if (match) plan.push({ photo, product: match });
    else unmatched.push(photo);
  }

  console.log(`\n${photos.length} image(s) in ${dir}, ${products.length} product(s)\n`);

  for (const { photo, product } of plan) {
    const bytes = statSync(join(dir, photo)).size;
    const size = `${(bytes / 1024).toFixed(0)} kB`;
    const replacing = product.image && !product.image.endsWith('.svg') ? ' (replaces existing photo)' : '';
    const warn = bytes > WARN_BYTES ? '  ⚠ large — compress before committing' : '';
    console.log(`  SET    ${product.slug}  ←  ${photo}  ${size}${replacing}${warn}`);
  }
  for (const photo of unmatched) {
    console.log(`  SKIP   ${photo}  — no product with that slug or SKU`);
  }

  const missing = products.filter(
    (p) => !plan.some((x) => x.product.slug === p.slug) && (!p.image || p.image.endsWith('.svg')),
  );
  for (const p of missing) {
    console.log(`  TODO   ${p.slug}  — still using placeholder artwork`);
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to copy the files and update frontmatter.\n');
    return;
  }

  mkdirSync(ASSET_DIR, { recursive: true });
  let written = 0;

  for (const { photo, product } of plan) {
    const ext = extname(photo).toLowerCase();
    const dest = join(ASSET_DIR, `${product.slug}${ext}`);
    copyFileSync(join(dir, photo), dest);

    let yaml = product.fm.yaml;
    yaml = setField(yaml, 'image', `../../assets/products/${product.slug}${ext}`).yaml;

    // Replace alt text that described the placeholder drawing. Leaving
    // "Hình minh hoạ..." on a real photograph tells a screen-reader user the
    // wrong thing about what they are looking at.
    const currentAlt = readField(yaml, 'imageAlt');
    const wasPlaceholderArt =
      product.image?.endsWith('.svg') && currentAlt?.startsWith('Hình minh hoạ');

    if (!currentAlt || wasPlaceholderArt) {
      yaml = setField(yaml, 'imageAlt', `Ảnh sản phẩm ${product.title ?? product.slug}`).yaml;
    }

    writeFileSync(join(PRODUCT_DIR, product.file), `---\n${yaml}\n---\n${product.fm.body}`);
    written++;
  }

  console.log(`\nUpdated ${written} product(s).`);
  console.log('Review the imageAlt lines — the default is generic, and alt text is');
  console.log('what a customer on a slow connection sees instead of your photo.\n');
}

main();
