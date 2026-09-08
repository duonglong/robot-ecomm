import { chromium } from 'playwright-core';
import { findChrome } from './browser.mjs';
const EXEC = findChrome();
const BASE = process.env.BASE || 'http://localhost:4321';
const OUT = process.env.OUT ?? './screenshots';
const jobs = [
  ['root-desktop', '/', 1440],
  ['firmware-desktop', '/firmware/', 1440],
  ['firmware-mobile', '/firmware/', 390],
  ['root-mobile', '/', 390],
];
const browser = await chromium.launch({ executablePath: EXEC });
for (const [name, path, width] of jobs) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await ctx.close();
  console.log('shot', name, width);
}
await browser.close();
