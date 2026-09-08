import { chromium } from 'playwright-core';
import { findChrome } from './browser.mjs';

const EXEC = findChrome();
const BASE = process.env.BASE || 'http://localhost:4322';
const OUT = process.env.OUT ?? "./screenshots";
const jobs = [
  ['home-mobile', '/', 390, true],
  ['shop-mobile', '/products/', 390, true],
  ['product-mobile', '/products/esp32-s3-n16r8-wifi-bluetooth-5-0/', 390, true],
  ['journal-mobile', '/blog/', 390, true],
  ['article-mobile', '/guides/nap-firmware-xiaozhi/', 390, true],
  ['home-desktop', '/', 1440, true],
  ['shop-desktop', '/products/', 1440, true],
  ['product-desktop', '/products/esp32-s3-n16r8-wifi-bluetooth-5-0/', 1440, true],
];
const browser = await chromium.launch({ executablePath: EXEC });
for (const [name, path, width, full] of jobs) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  await ctx.close();
  console.log('shot', name, width);
}
await browser.close();
