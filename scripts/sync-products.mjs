#!/usr/bin/env node
/**
 * Sync product stubs from a Shopee Seller Centre export.
 *
 * Shopee owns the catalogue: which products exist, their SKUs, their listing
 * URLs and whether they are in stock. This repo owns the editorial: tagline,
 * specs, category and the long description you write by hand.
 *
 * This script only ever writes the MANAGED_FIELDS below. Your prose is never
 * touched. New products arrive as `draft: true` stubs so 40 empty pages cannot
 * accidentally go live before you have written copy for them.
 *
 * Usage:
 *   node scripts/sync-products.mjs export.csv                 # dry run
 *   node scripts/sync-products.mjs export.csv --apply         # write files
 *   node scripts/sync-products.mjs export.csv --shop-id=1234  # build buyUrls
 *   node scripts/sync-products.mjs export.csv --apply --images # + fetch photos
 *
 * --images downloads the cover photo named in the export into
 * src/assets/products/. Those are YOUR listing photos, so using them here is
 * fine; never point this at another shop's images.
 *
 * Export from Seller Centre → Products → Mass Update → Export, then save the
 * .xlsx as .csv. (Parsing .xlsx would mean a heavy dependency for a file you
 * touch a few times a month; "Save as CSV" is one click.)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const PRODUCT_DIR = 'src/content/products';

/** Only these frontmatter keys are ever written. Everything else is yours. */
const MANAGED_FIELDS = ['sku', 'buyUrl', 'availability'];

/**
 * Shopee's column headers vary by region, account language and export version,
 * so match on a list of known aliases rather than a fixed index. Vietnamese
 * headers included because shopee.vn exports in the account's locale.
 */
const COLUMN_ALIASES = {
  name: ['product name', 'ten san pham', 'tên sản phẩm', 'product_name'],
  sku: [
    'parent sku', 'sku reference no.', 'sku', 'ma sku', 'mã sku',
    'sku san pham', 'sku sản phẩm', 'sku phân loại',
  ],
  itemId: [
    'product id', 'shopee product id', 'item id', 'ma san pham',
    'mã sản phẩm', 'product_id',
  ],
  url: ['product link', 'url', 'link', 'lien ket', 'liên kết'],
  image: [
    'image', 'cover image', 'main image', 'image url', 'anh bia', 'ảnh bìa',
    'hinh anh', 'hình ảnh', 'anh san pham', 'ảnh sản phẩm',
  ],
  stock: ['stock', 'total stock', 'kho hang', 'kho hàng', 'ton kho', 'tồn kho'],
  status: ['status', 'product status', 'trang thai', 'trạng thái'],
};

// ---------------------------------------------------------------- CSV parsing

/**
 * Minimal RFC-4180 parser. Handles quoted fields, embedded commas, embedded
 * newlines and doubled quotes — all of which appear in Shopee product names.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // Strip UTF-8 BOM; Excel adds one and it corrupts the first header name.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += char;
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\r') { /* handled by \n */ }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function detectColumns(header) {
  const normalized = header.map((h) => h.trim().toLowerCase());
  const found = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx !== -1) found[key] = idx;
  }
  return found;
}

// ------------------------------------------------------------------- slugging

/** `Bộ Kit Hexapod 18 Servo` -> `bo-kit-hexapod-18-servo` */
function slugify(input) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip Vietnamese tone marks
    .replace(/[đĐ]/g, 'd')            // đ has no combining-mark decomposition
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function toAvailability(stockRaw, statusRaw) {
  const status = (statusRaw ?? '').trim().toLowerCase();
  if (status && /(unlist|delist|banned|deleted|da an|đã ẩn)/.test(status)) {
    return 'sold-out';
  }
  const stock = Number.parseInt((stockRaw ?? '').replace(/[^0-9-]/g, ''), 10);
  if (Number.isFinite(stock)) return stock > 0 ? 'in-stock' : 'sold-out';
  return 'in-stock';
}

// ------------------------------------------------------- frontmatter rewriting

function splitFrontmatter(content) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(content);
  if (!match) return null;
  return { yaml: match[1], body: content.slice(match[0].length) };
}

/**
 * Set a scalar key in a YAML block, replacing it in place if present and
 * appending if not. Deliberately line-based: a real YAML round-trip would
 * reformat and reorder the whole file, destroying the comments you left there.
 */
function needsQuoting(value) {
  // `buyUrl: https://x/y` is valid YAML — a colon only breaks parsing when
  // followed by a space. Quoting every URL just because it contains "://"
  // would make synced files differ cosmetically from hand-written ones.
  return (
    value === '' ||
    /^[-?:,\[\]{}#&*!|>'"%@`]/.test(value) ||
    /:\s/.test(value) ||
    /\s#/.test(value) ||
    /^\s|\s$/.test(value)
  );
}

function setYamlField(yaml, key, value) {
  let lines = yaml.split('\n');
  const line = `${key}: ${needsQuoting(value) ? JSON.stringify(value) : value}`;
  const keyRe = new RegExp(`^${key}\\s*:`);

  // Drop any commented-out placeholder for this key (`# buyUrl: https://...`).
  // Leaving it next to a real value reads as two conflicting settings.
  const before = lines.length;
  lines = lines.filter((l) => !new RegExp(`^#\\s*${key}\\s*:`).test(l));
  let changed = lines.length !== before;

  const idx = lines.findIndex((l) => keyRe.test(l));
  if (idx !== -1) {
    if (lines[idx] === line) return { yaml: lines.join('\n'), changed };
    lines[idx] = line;
    return { yaml: lines.join('\n'), changed: true };
  }

  // Insert after the LAST identity field so managed values sit together under
  // title/tagline/sku — never at the end, where they would land inside the
  // multi-line `specs:` list and silently become list items.
  let anchor = -1;
  lines.forEach((l, i) => {
    if (/^(title|tagline|sku)\s*:/.test(l)) anchor = i;
  });
  lines.splice(anchor + 1, 0, line);
  return { yaml: lines.join('\n'), changed: true };
}

function stubFor({ name, sku, buyUrl, availability }) {
  return `---
title: ${JSON.stringify(name)}
tagline: TODO — một dòng dưới 90 ký tự, hiển thị trên thẻ sản phẩm.
sku: ${sku}
${buyUrl ? `buyUrl: ${buyUrl}\n` : ''}availability: ${availability}
category: parts
order: 0
draft: true
specs: []
---

TODO: viết mô tả chi tiết.

Được tạo tự động từ file xuất Shopee. Sản phẩm sẽ không hiển thị trên site cho
đến khi bạn xoá dòng \`draft: true\`.
`;
}

// ----------------------------------------------------------------------- main

const ASSET_DIR = 'src/assets/products';

/**
 * Fetch each product's cover photo. Skips anything already holding a real
 * photo so a re-sync does not re-download the whole catalogue, and skips
 * failures rather than aborting — one dead URL should not stop the run.
 */
async function downloadImages(products) {
  const withUrls = products.filter((p) => p.imageUrl);
  if (withUrls.length === 0) {
    console.log('\n--images: no image column found in the export.');
    return;
  }

  mkdirSync(ASSET_DIR, { recursive: true });
  let got = 0;
  let skipped = 0;

  for (const p of withUrls) {
    const file = join(PRODUCT_DIR, `${p.slug}.md`);
    if (existsSync(file)) {
      const fm = splitFrontmatter(readFileSync(file, 'utf8'));
      const current = fm && /^image\s*:\s*(.+)$/m.exec(fm.yaml)?.[1]?.trim();
      if (current && !current.endsWith('.svg')) {
        skipped++;
        continue;
      }
    }

    try {
      const res = await fetch(p.imageUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());

      const type = res.headers.get('content-type') ?? '';
      const ext =
        (type.includes('webp') && '.webp') ||
        (type.includes('png') && '.png') ||
        (type.includes('avif') && '.avif') ||
        (extname(new URL(p.imageUrl).pathname).toLowerCase() || '.jpg');

      const dest = join(ASSET_DIR, `${p.slug}${ext}`);
      writeFileSync(dest, buf);

      if (existsSync(file)) {
        const content = readFileSync(file, 'utf8');
        const fm = splitFrontmatter(content);
        let yaml = setYamlField(fm.yaml, 'image', `../../assets/products/${p.slug}${ext}`).yaml;
        yaml = setYamlField(yaml, 'imageAlt', `Ảnh sản phẩm ${p.name}`).yaml;
        writeFileSync(file, `---\n${yaml}\n---\n${fm.body}`);
      }

      console.log(`  IMAGE   ${p.slug}${ext}  ${(buf.length / 1024).toFixed(0)} kB`);
      got++;
    } catch (err) {
      console.log(`  FAILED  ${p.slug}  — ${err.message}`);
    }
  }

  console.log(`\n${got} image(s) downloaded, ${skipped} already had a photo.`);
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const apply = args.includes('--apply');
  const shopId = (args.find((a) => a.startsWith('--shop-id=')) ?? '').split('=')[1];

  if (!file) {
    console.error('Usage: node scripts/sync-products.mjs <export.csv> [--apply] [--shop-id=N]');
    process.exit(1);
  }
  if (!existsSync(file)) {
    console.error(`No such file: ${file}`);
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(file, 'utf8'));
  if (rows.length < 2) {
    console.error('Export appears empty.');
    process.exit(1);
  }

  const [header, ...dataRows] = rows;
  const cols = detectColumns(header);

  if (cols.name === undefined || (cols.sku === undefined && cols.itemId === undefined)) {
    console.error('Could not identify the required columns.\n');
    console.error('Found these headers:');
    header.forEach((h, i) => console.error(`  [${i}] ${h}`));
    console.error('\nAdd the right names to COLUMN_ALIASES at the top of this script.');
    process.exit(1);
  }

  const at = (row, key) => (cols[key] === undefined ? '' : (row[cols[key]] ?? '').trim());

  // Shopee exports one row PER VARIATION. Collapse to one entry per product,
  // keyed by item id where available, so a 3-colour product is one page.
  const products = new Map();
  for (const row of dataRows) {
    const name = at(row, 'name');
    if (!name) continue;

    const itemId = at(row, 'itemId');
    const sku = at(row, 'sku');
    const key = itemId || sku || name;

    const existing = products.get(key);
    // Any variation in stock means the product is buyable.
    const availability = toAvailability(at(row, 'stock'), at(row, 'status'));

    if (existing) {
      if (availability === 'in-stock') existing.availability = 'in-stock';
      continue;
    }

    const imageUrl = at(row, 'image');
    let buyUrl = at(row, 'url');
    if (!buyUrl && itemId && shopId) {
      buyUrl = `https://shopee.vn/product/${shopId}/${itemId}`;
    }

    products.set(key, {
      name,
      sku: sku || itemId,
      buyUrl,
      imageUrl,
      availability,
      slug: slugify(name),
    });
  }

  // Index existing files by SKU so a renamed product updates instead of
  // duplicating. Falls back to slug for files predating the sync script.
  const existingFiles = existsSync(PRODUCT_DIR)
    ? readdirSync(PRODUCT_DIR).filter((f) => f.endsWith('.md'))
    : [];
  const bySku = new Map();
  const bySlug = new Map();
  for (const f of existingFiles) {
    const content = readFileSync(join(PRODUCT_DIR, f), 'utf8');
    const fm = splitFrontmatter(content);
    const sku = fm && /^sku\s*:\s*(.+)$/m.exec(fm.yaml)?.[1]?.trim().replace(/^["']|["']$/g, '');
    if (sku) bySku.set(sku, f);
    bySlug.set(f.replace(/\.md$/, ''), f);
  }

  const plan = { create: [], update: [], unchanged: [], orphan: [] };
  const seenFiles = new Set();

  for (const p of products.values()) {
    // Third strategy, for products seeded from a storefront screenshot: the
    // grid truncates names, so a seeded slug is a PREFIX of the real one.
    // Matching on that stops a real export creating 34 duplicates alongside
    // the drafts. 20 chars is long enough that two products do not collide.
    const byPrefix = () => {
      const hit = [...bySlug.keys()].filter(
        (slug) => slug.length >= 20 && p.slug.startsWith(slug),
      );
      return hit.length === 1 ? bySlug.get(hit[0]) : undefined;
    };

    const file = bySku.get(p.sku) ?? bySlug.get(p.slug) ?? byPrefix();

    if (!file) {
      plan.create.push(p);
      continue;
    }
    seenFiles.add(file);

    const path = join(PRODUCT_DIR, file);
    const content = readFileSync(path, 'utf8');
    const fm = splitFrontmatter(content);
    if (!fm) {
      console.warn(`  ! ${file} has no frontmatter, skipping`);
      continue;
    }

    let yaml = fm.yaml;
    const changes = [];
    for (const field of MANAGED_FIELDS) {
      const value = p[field];
      if (!value) continue;
      const res = setYamlField(yaml, field, value);
      if (res.changed) changes.push(field);
      yaml = res.yaml;
    }

    if (changes.length > 0) {
      plan.update.push({ ...p, file, changes, next: `---\n${yaml}\n---\n${fm.body}` });
    } else {
      plan.unchanged.push(p);
    }
  }

  for (const f of existingFiles) {
    if (!seenFiles.has(f) && !plan.create.some((p) => `${p.slug}.md` === f)) {
      plan.orphan.push(f);
    }
  }

  // ----------------------------------------------------------------- report
  console.log(`\nParsed ${dataRows.length} rows → ${products.size} products\n`);

  for (const p of plan.create) console.log(`  CREATE   ${p.slug}.md  (${p.sku})`);
  for (const p of plan.update) console.log(`  UPDATE   ${p.file}  [${p.changes.join(', ')}]`);
  for (const f of plan.orphan) console.log(`  ORPHAN   ${f}  — not in export, left alone`);
  if (plan.unchanged.length) console.log(`  ${plan.unchanged.length} unchanged`);

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to write these changes.\n');
    return;
  }

  for (const p of plan.create) {
    writeFileSync(join(PRODUCT_DIR, `${p.slug}.md`), stubFor(p));
  }
  for (const p of plan.update) {
    writeFileSync(join(PRODUCT_DIR, p.file), p.next);
  }

  if (args.includes('--images')) {
    await downloadImages([...products.values()]);
  }

  console.log(`\nWrote ${plan.create.length} new, ${plan.update.length} updated.`);
  if (plan.create.length) {
    console.log('New products are draft: true — write copy, then remove that line.');
  }
  if (plan.orphan.length) {
    console.log(`${plan.orphan.length} file(s) had no matching export row. Delisted on Shopee?`);
  }
  console.log();
}

await main();
