import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Find a Chromium to drive. Prefers CHROME_PATH, then a Playwright-managed
 * download, then a system install. These tools are optional dev utilities —
 * if none of these exist, they tell you rather than failing cryptically.
 */
export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    const dirs = readdirSync(cache)
      .filter((d) => d.startsWith('chromium-'))
      .sort()
      .reverse();
    for (const dir of dirs) {
      for (const rel of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const candidate = join(cache, dir, rel);
        if (existsSync(candidate)) return candidate;
      }
    }
  }

  for (const candidate of [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    'No Chromium found. Set CHROME_PATH=/path/to/chrome, or run: npx playwright install chromium',
  );
}
