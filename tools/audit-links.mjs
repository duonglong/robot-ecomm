#!/usr/bin/env node
/**
 * Verify every internal link in the built site resolves to a real page.
 *
 * Cross-links between products and guides are written by hand in Markdown,
 * so renaming or deleting a content file silently breaks them — the build
 * succeeds and the 404 only shows up when a customer clicks. Run after
 * touching content.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

if (!existsSync(DIST)) {
  console.error('No dist/ — run `npm run build` first.');
  process.exit(1);
}

const files = walk(DIST);
const pages = files.filter((f) => f.endsWith('.html'));

/** A link resolves if it maps to a real file under dist/. */
function resolves(href) {
  const clean = href.split('#')[0].split('?')[0];
  if (clean === '' || clean === '/') return existsSync(join(DIST, 'index.html'));
  const path = join(DIST, clean);
  if (existsSync(path) && statSync(path).isFile()) return true;
  // /products/foo/ → dist/products/foo/index.html
  return existsSync(join(path, 'index.html'));
}

let broken = 0;
let checked = 0;

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  for (const href of hrefs) {
    // Internal only: skip external, mailto, tel, anchors and protocol-relative.
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    checked++;
    if (!resolves(href)) {
      broken++;
      console.log(`  BROKEN  ${relative(DIST, page)}  →  ${href}`);
    }
  }
}

console.log(
  broken === 0
    ? `\n${checked} internal links checked across ${pages.length} pages, all resolve.`
    : `\n${broken} broken link(s) out of ${checked} checked.`,
);
process.exit(broken === 0 ? 0 : 1);
