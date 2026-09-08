import { chromium } from 'playwright-core';

import { findChrome } from './browser.mjs';

const EXEC = findChrome();
const BASE = process.env.BASE || 'http://localhost:4322';
const PAGES = ['/', '/products/', '/products/hexapod-starter-kit/', '/blog/', '/guides/powering-servos/', '/404.html'];
const WIDTHS = [360, 390, 768, 1280, 1600];

const browser = await chromium.launch({ executablePath: EXEC });
let bad = 0;

for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const overflow = de.scrollWidth - de.clientWidth;
      const offenders = [];
      if (overflow > 0) {
        for (const el of document.querySelectorAll('body *')) {
          const b = el.getBoundingClientRect();
          if (b.width === 0) continue;
          if (b.right > de.clientWidth + 1 || b.left < -1) {
            offenders.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.getAttribute('class') || '').slice(0, 48),
              right: Math.round(b.right),
              width: Math.round(b.width),
            });
          }
        }
      }
      return { overflow, clientWidth: de.clientWidth, offenders: offenders.slice(0, 6) };
    });
    if (r.overflow > 0) {
      bad++;
      console.log(`OVERFLOW ${w}px ${path} -> +${r.overflow}px (viewport ${r.clientWidth})`);
      for (const o of r.offenders) console.log(`    <${o.tag} class="${o.cls}"> w=${o.width} right=${o.right}`);
    }
  }
  await ctx.close();
}

await browser.close();
console.log(bad === 0 ? '\nNo horizontal overflow at any width.' : `\n${bad} page/width combos overflow.`);
