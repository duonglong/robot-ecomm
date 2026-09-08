// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Set this to your real domain before launch. It is used for canonical URLs,
// sitemap.xml and the RSS feed — wrong value here means wrong links in Google.
const SITE = process.env.SITE_URL ?? 'https://robot-ecomm.pages.dev';

export default defineConfig({
  site: SITE,
  integrations: [sitemap()],
  // The catalogue moved to the site root. /products/ was live before that, so
  // keep it reachable instead of returning a 404 to anything already indexed.
  redirects: {
    '/products': '/',
  },
  // Static output: every page is prerendered to HTML at build time.
  // This is what makes Cloudflare Pages free — no server runs per request.
  output: 'static',
  build: {
    // /products/foo/index.html instead of /products/foo.html — nicer URLs.
    format: 'directory',
  },
  markdown: {
    shikiConfig: { theme: 'github-light', wrap: true },
  },
});
