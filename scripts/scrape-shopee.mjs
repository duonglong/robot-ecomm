#!/usr/bin/env node
/**
 * Read your own Shopee shop's product list into a CSV.
 *
 * The shop page is a single-page app and its JSON API rejects plain HTTP
 * requests, so this drives a real browser and captures the API responses the
 * page makes for itself. Output is a CSV shaped for scripts/sync-products.mjs,
 * so the tested import path stays the one that writes your content:
 *
 *   node scripts/scrape-shopee.mjs nguyenduchuy970 --out shop.csv
 *   npm run sync:products -- shop.csv --apply --images
 *
 * Use it on YOUR shop.
 *
 * Shopee requires a logged-in session to serve a shop's product list — an
 * anonymous visit is redirected to /verify/traffic/error ("Cần đăng nhập").
 * So log in once, in a real browser window, into a profile kept on disk:
 *
 *   node scripts/scrape-shopee.mjs nguyenduchuy970 --login
 *
 * That opens Shopee, waits while you sign in yourself, and saves the session
 * to .shopee-profile/ (gitignored). No password ever passes through this
 * script. Later runs reuse that profile and can be headless.
 *
 * When Shopee changes their API this breaks. The Seller Centre export path
 * (scripts/sync-products.mjs) depends on none of this and is the fallback.
 *
 * Options:
 *   --login          open a window to sign in, save the session, then exit
 *   --login-timeout N seconds to wait for sign-in (default 900)
 *   --out <file>     output CSV (default shopee-products.csv)
 *   --headed         show the browser during a normal run
 *   --profile <dir>  session directory (default .shopee-profile)
 *   --max-scrolls N  how hard to try lazy-loading more items (default 40)
 */

import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { chromium } from 'playwright-core';
import { findChrome } from '../tools/browser.mjs';

const IMG_CDN = 'https://down-vn.img.susercontent.com/file/';

/**
 * Wait until the browser actually holds a signed-in session.
 *
 * Deliberately NOT "the URL stopped being /buyer/login" — Shopee routes
 * sign-in through captcha and OTP pages that each have their own URL, so a
 * URL check reports success while the user is still solving a puzzle, and the
 * window gets closed underneath them.
 *
 * Instead: ask Shopee who we are, every few seconds, from inside the page.
 * Also resolves on Enter in the terminal, as a manual override.
 */
async function waitForLogin(ctx, page, timeoutMs) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let manual = false;
  rl.once('line', () => {
    manual = true;
  });

  const deadline = Date.now() + timeoutMs;
  let lastNote = 0;

  try {
    while (Date.now() < deadline) {
      if (manual) return true;

      // The page may be mid-navigation while the user works; that is not an error.
      const who = await page
        .evaluate(async () => {
          try {
            const r = await fetch('/api/v4/account/basic/get_account_info', {
              credentials: 'include',
            });
            if (!r.ok) return null;
            const j = await r.json();
            const d = j?.data ?? j;
            return d?.userid || d?.username || d?.shopid ? d : null;
          } catch {
            return null;
          }
        })
        .catch(() => null);

      if (who) {
        rl.close();
        const name = who.username ?? who.userid;
        console.log(`\r  signed in as ${name}                      `);
        return true;
      }

      const waited = Math.round((timeoutMs - (deadline - Date.now())) / 1000);
      if (waited - lastNote >= 15) {
        lastNote = waited;
        process.stdout.write(`\r  waiting for sign-in... ${waited}s`);
      }
      await page.waitForTimeout(3000);
    }
    return manual;
  } finally {
    rl.close();
  }
}

/** Walk arbitrary JSON and collect anything that looks like a shop item. */
function harvest(node, out, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 12) return;
  if (Array.isArray(node)) {
    for (const child of node) harvest(child, out, depth + 1);
    return;
  }
  const id = node.itemid ?? node.item_id;
  if (id && typeof node.name === 'string' && node.name.trim()) {
    out.set(String(id), node);
  }
  for (const value of Object.values(node)) harvest(value, out, depth + 1);
}

function csvCell(value) {
  const s = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  if (!target) {
    console.error('Usage: node scripts/scrape-shopee.mjs <username|shop-url> [--out f.csv] [--headed]');
    process.exit(1);
  }

  const outFile = (args.find((a) => a.startsWith('--out=')) ?? '').split('=')[1]
    ?? (args[args.indexOf('--out') + 1] && !args[args.indexOf('--out') + 1].startsWith('--')
        ? args[args.indexOf('--out') + 1]
        : 'shopee-products.csv');
  const headed = args.includes('--headed');
  const maxScrolls = Number((args.find((a) => a.startsWith('--max-scrolls=')) ?? '').split('=')[1] ?? 40);
  const loginTimeout =
    Number((args.find((a) => a.startsWith('--login-timeout=')) ?? '').split('=')[1] ?? 900) * 1000;

  const username = target.replace(/^https?:\/\/[^/]+\//, '').split(/[/#?]/)[0];
  const url = `https://shopee.vn/${username}`;

  const login = args.includes('--login');
  const profileIdx = args.indexOf('--profile');
  const profile =
    (args.find((a) => a.startsWith('--profile=')) ?? '').split('=')[1] ??
    (profileIdx !== -1 ? args[profileIdx + 1] : null) ??
    '.shopee-profile';

  // A persistent profile keeps the login between runs. Locale matters: Shopee
  // serves different payloads per region, and a mismatch is a common reason
  // the product list comes back empty even when signed in.
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: findChrome(),
    headless: !headed && !login,
    viewport: { width: 1366, height: 900 },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  });
  const browser = ctx.browser() ?? { close: () => ctx.close() };

  if (login) {
    const page = await ctx.newPage();
    await page.goto('https://shopee.vn/buyer/login', { waitUntil: 'domcontentloaded' });

    console.log('\nA browser window is open. Sign in to Shopee there.');
    console.log('Take as long as you need — captcha, OTP, SMS, all fine.');
    console.log('The window stays open until sign-in is confirmed.');
    console.log('(Or press Enter here once you are done.)\n');

    const ok = await waitForLogin(ctx, page, loginTimeout);

    if (ok) {
      await page.waitForTimeout(2500);
      console.log(`\nSigned in. Session saved to ${profile}/`);
      console.log(`Now run:  node scripts/scrape-shopee.mjs ${username} --out shop.csv\n`);
    } else {
      console.log('\nStopped without confirming sign-in.');
      console.log(`If you did sign in, the profile in ${profile}/ may still work —`);
      console.log(`just run the scrape and see.\n`);
    }
    await ctx.close();
    return;
  }

  const items = new Map();
  let apiHits = 0;

  ctx.on('response', async (res) => {
    const u = res.url();
    if (!u.includes('/api/v4/') && !u.includes('/api/v2/')) return;
    if (!(res.headers()['content-type'] ?? '').includes('json')) return;
    try {
      const body = await res.json();
      const before = items.size;
      harvest(body, items);
      if (items.size > before) apiHits++;
    } catch {
      /* non-JSON or already consumed — ignore */
    }
  });

  console.log(`\nOpening ${url}`);
  let wall = null;
  await ctx.newPage().then(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3500);

    // Shopee bounces anonymous traffic to a login wall, and automated traffic
    // to an anti-crawler captcha tagged scene=crawler_item — being signed in
    // does not avoid the second one.
    const here = page.url();
    if (/\/verify\/captcha/.test(here)) {
      wall = 'captcha';
      return;
    }
    if (/\/verify\/traffic|\/buyer\/login/.test(here)) {
      wall = 'login';
      return;
    }

    let stale = 0;
    for (let i = 0; i < maxScrolls && stale < 6; i++) {
      const before = items.size;
      await page.mouse.wheel(0, 2200);
      await page.waitForTimeout(900);

      // Shopee paginates rather than infinite-scrolling once you reach the end.
      if (items.size === before) {
        const next = page.locator('button.shopee-icon-button--right').first();
        if (await next.count().catch(() => 0)) {
          await next.click().catch(() => {});
          await page.waitForTimeout(2200);
        }
      }
      stale = items.size === before ? stale + 1 : 0;
      if (items.size !== before) {
        process.stdout.write(`\r  captured ${items.size} products...`);
      }
    }
    console.log(`\r  captured ${items.size} products from ${apiHits} API response(s).   `);
  });

  await browser.close();

  if (wall === 'captcha') {
    console.error(
      '\nShopee served its anti-crawler captcha (scene=crawler_item). Being\n' +
      'signed in does not avoid this — it is aimed at automation specifically,\n' +
      'and working around it would mean defeating their bot protection.\n\n' +
      'Use the Seller Centre export for your own catalogue instead:\n' +
      '  Sản phẩm → Quản lý hàng loạt → Xuất, save as CSV, then\n' +
      '  npm run sync:products -- export.csv --apply\n',
    );
    process.exit(1);
  }

  if (wall === 'login') {
    console.error(
      `\nShopee redirected to its login wall — this session is not signed in.\n\n` +
      `  node scripts/scrape-shopee.mjs ${username} --login\n\n` +
      `signs in once and saves the session to ${profile}/, then re-run this.\n`,
    );
    process.exit(1);
  }

  if (items.size === 0) {
    console.error(
      '\nSigned in, but no products captured — the page loaded without calling\n' +
      'its product API. Re-run with --headed to watch what it does. If Shopee\n' +
      'has changed their API, use the Seller Centre export instead: it needs\n' +
      'no scraping and does not break.\n',
    );
    process.exit(1);
  }

  // Column names match COLUMN_ALIASES in scripts/sync-products.mjs.
  const header = ['Mã sản phẩm', 'Tên sản phẩm', 'SKU sản phẩm', 'Kho hàng', 'Trạng thái', 'Ảnh bìa', 'Product Link'];
  const rows = [...items.values()].map((it) => {
    const id = it.itemid ?? it.item_id;
    const shopid = it.shopid ?? it.shop_id ?? '';
    const image = it.image ?? it.images?.[0] ?? '';
    return [
      id,
      it.name,
      it.item_sku || it.sku || '',
      it.stock ?? '',
      it.status === 1 || it.status === undefined ? 'Live' : 'Unlisted',
      image ? IMG_CDN + image : '',
      shopid && id ? `https://shopee.vn/product/${shopid}/${id}` : '',
    ];
  });

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
  writeFileSync(outFile, '﻿' + csv);

  const withImages = rows.filter((r) => r[5]).length;
  const withSku = rows.filter((r) => r[2]).length;

  console.log(`\nWrote ${rows.length} products to ${outFile}`);
  console.log(`  ${withImages} have a cover image, ${withSku} have an SKU set on Shopee.`);
  console.log('\nNext:');
  console.log(`  npm run sync:products -- ${outFile}                 # preview`);
  console.log(`  npm run sync:products -- ${outFile} --apply --images\n`);
}

await main();
