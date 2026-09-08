# Robot Ecomm

Static storefront + content site for an AI-robotics niche shop. Astro, no
database, no server, no monthly hosting bill.

- **Products, guides and blog posts are Markdown files.** `git push` is the CMS.
- **Prices are never shown here.** Shopee is the only price of record.
- **Checkout is external.** Buy buttons hand off to our Shopee shop; the site itself takes no payments.
- **Hosting is Cloudflare Pages**, free tier, unlimited bandwidth.
- **Design is Aether Kinetic**, ported from `sample_designs/`. Zero runtime JS.
- **The site is Vietnamese.** UI strings, labels and sample content. This
  README stays in English as developer documentation.

## Requirements

Node **22.19.0 or newer** (see `.nvmrc`). Astro 7 requires ≥22.12, and one
transitive dependency (`undici`) wants ≥22.19 — below that you get an
`EBADENGINE` warning at install time.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server at http://localhost:4321 |
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve `dist/` locally, exactly as it will deploy |
| `npm run check` | Type-check `.astro` files and content frontmatter |
| `npm run audit:layout` | Check every page for horizontal overflow, 360→1600px |
| `npm run audit:links` | Verify every internal link resolves (no browser needed) |
| `npm run shots` | Screenshot key pages to `screenshots/` |
| `npm run sync:products -- export.csv` | Sync product stubs from a Shopee export (dry run) |
| `npm run deploy` | Build + upload to Cloudflare Pages via wrangler |

## Adding a product

Create `src/content/products/my-thing.md`. The filename becomes the URL
(`/products/my-thing/`). Frontmatter is validated at build time — a typo fails
the build instead of shipping a broken page.

```markdown
---
title: My Thing
tagline: One line, under ~90 characters, shown on the product card.
sku: KIT-THING-01
buyUrl: https://shopee.vn/...   # omit → button falls back to SHOP_URL
category: kits                  # kits | parts | sensors | compute
availability: in-stock          # in-stock | preorder | sold-out
featured: true                  # surfaces it on the home page
order: 1                        # sort order within its category
specs:
  - Bullet points shown in the sidebar box
---

Markdown body becomes the long description below the fold.
```

**There is no `price` field, deliberately.** See *Why prices live only on
Shopee* below.

**Images are optional.** Drop a file in `src/assets/`, then reference it
relatively: `image: ../../assets/my-thing.jpg` plus `imageAlt: ...`. Astro
resizes it and emits webp. Without an image you get a neutral placeholder, so
the catalogue builds fine before photography exists.

Blog posts go in `src/content/posts/`, guides in `src/content/guides/`. Both
take `title`, `description`, `pubDate`, optional `updatedDate`, `tags`,
`heroImage`, and `draft: true` (drafts show in `npm run dev`, never in builds).

## Wiring up the buy button

There is no payment code in this repo. Buttons link out to the marketplace.

**To activate every button at once:** set `SHOP_URL` in `src/consts.ts` to your
Shopee shop URL. While it is empty, buttons render disabled — deliberately,
because shipping a dead link is worse than shipping a disabled one.

**To deep-link a single product:** add `buyUrl:` to its frontmatter pointing at
that listing. It overrides `SHOP_URL` and changes the label from
"Find it on Shopee" to "Buy on Shopee — $96.50".

Button states, all four verified:

| `SHOP_URL` | `buyUrl` | `availability` | Renders |
|---|---|---|---|
| empty | — | any | Disabled, "Not yet listed" |
| set | — | in-stock | "Find it on Shopee" → shop homepage |
| set | set | in-stock | "Buy on Shopee — $96.50" → listing |
| any | any | sold-out | Disabled, "Sold out" |

### Why prices live only on Shopee

Shopee prices move — flash sales, vouchers, campaign discounts. A static build
freezes whatever number was in the Markdown at build time, so within a week the
site would be quoting a price the checkout page disagrees with. That erodes
trust at exactly the moment someone is deciding to buy, and Google suppresses
`Offer` rich results whose price disagrees with the landing page.

So product pages publish `Product` schema markup with name, SKU and category
but **no `offers` block**. The button says "View price & buy on Shopee". One
price of record, no sync to forget.

If you later host your own checkout, add `price` back to the schema in
`src/content.config.ts` and re-add the `offers` block in
`src/pages/products/[...slug].astro` — the git history has both.

## Syncing products from Shopee

At 40+ products, hand-writing a Markdown file per SKU is the wrong shape.
`scripts/sync-products.mjs` reads a Seller Centre export and maintains the
fields Shopee owns.

```bash
# Seller Centre → Products → Mass Update → Export, then save the .xlsx as .csv
npm run sync:products -- ~/Downloads/export.csv --shop-id=998877   # dry run
npm run sync:products -- ~/Downloads/export.csv --shop-id=998877 --apply
```

**It only ever writes `sku`, `buyUrl` and `availability`.** Your tagline,
specs, category and prose are never touched — the script edits those three
lines and leaves the rest of the file, including your comments, byte for byte.

What it handles:

- **One row per variation.** Shopee exports a row per colour/size; these are
  collapsed into one product page, in stock if *any* variation is.
- **Matching by SKU, not filename.** Rename a product on Shopee and it updates
  the existing file instead of creating a duplicate.
- **Vietnamese product names.** `Bộ Kit Hexapod` → `bo-kit-hexapod.md`.
- **Localised column headers.** Both English and Vietnamese Seller Centre
  exports are recognised. If your export uses names it does not know, it prints
  the headers it found and exits — add them to `COLUMN_ALIASES` at the top.
- **`buyUrl` construction.** Uses the export's link column if present, else
  builds `https://shopee.vn/product/<shop-id>/<item-id>` from `--shop-id`.
- **Delisted products.** Files with no matching export row are reported as
  `ORPHAN` and left alone — never auto-deleted, since a product missing from
  one export is usually a filter mistake, not a decision to unpublish.

New products are written as **`draft: true` stubs** with `TODO` placeholders,
so importing 40 SKUs does not put 40 empty pages live. Write the tagline and
body, delete the `draft` line, and it publishes on the next build.

Dry run is the default. Nothing is written without `--apply`.

Test it against `scripts/example-shopee-export.csv` to see the output shape.

### Moving to self-hosted checkout later

Nothing here assumes a marketplace. Put a Stripe Payment Link in `buyUrl`
instead of a Shopee URL and the button points at Stripe — no code change. Only
the button label needs updating, via `SHOP_NAME` in `src/consts.ts`.

## The catalogue

`src/content/products/` holds **34 draft products**, seeded from screenshots of
the Shopee storefront. Every one is `draft: true`, so they render in
`npm run dev` and are excluded from production builds — the live site shows an
empty shop until you clear the flags.

What is real: titles, taglines, categories, stock status.
What is placeholder: `sku: TODO-nnn`, the body text, and there is no `buyUrl`,
so every buy button is disabled.

Each file carries an HTML comment with the Shopee price and units sold, for
reference while you write copy. Prices are never rendered.

### Finishing a product

1. Replace the TODO body with a real description
2. Add real `specs` as `Key: Value` lines
3. Delete the `draft: true` line

It goes live on the next build.

### When the real export arrives

Do **not** delete the drafts first. `sync-products.mjs` matches an export row to
an existing file three ways: by SKU, by exact slug, and — for exactly this
case — by **slug prefix**. Storefront grids truncate product names, so a seeded
slug is a prefix of the real one, and prefix matching updates the draft in place
instead of creating a duplicate beside it.

So: run the export, and the 34 drafts gain their real SKUs and buy links while
keeping the copy you wrote.

### Categories and filtering

Four categories, defined in `src/content.config.ts` and labelled in
`src/utils.ts`:

| Key | Label | Count |
|---|---|---|
| `robots` | Robot AI hoàn chỉnh | 14 |
| `kits` | Bộ kit DIY | 12 |
| `boards` | Bo mạch | 7 |
| `parts` | Phụ kiện & khác | 1 |

Order in `CATEGORY_LABEL` is the order they appear in the catalogue — finished
robots first, since that is where the margin is.

`/products/` shows every product in one grid, no per-category sections.
`sortProducts` keeps same-category items adjacent so the grouping reads without
needing a heading for it. Filtering is a prerendered page per category at
`/products/danh-muc/<key>/`, generated only for categories that contain
something, so it works with zero JavaScript and each category gets an indexable
landing page.

### After editing content, run the link checker

Cross-links between products and guides are hand-written Markdown. Renaming or
deleting a content file breaks them silently — the build still succeeds and the
404 only surfaces when a customer clicks. `npm run audit:links` walks the built
site and fails on any internal link that does not resolve.

## Language

The site is Vietnamese only — `<html lang="vi">`, no i18n routing, no language
switcher. Adding English later means Astro's i18n routing and a translated
copy of every content file; nothing here blocks that, but nothing anticipates
it either.

Where the Vietnamese lives:

| What | Where |
|---|---|
| Site title, nav, footer, description | `src/consts.ts` |
| Stock status, category names | `AVAILABILITY_LABEL` / `CATEGORY_LABEL` in `src/utils.ts` |
| Section labels, buttons, empty states | inline in each `.astro` file |
| Products, guides, posts | `src/content/` |

**Category keys stay English** (`kits`, `sensors`, `compute`) because they are
frontmatter values the sync script writes and the URL anchors use. Only their
display labels are translated.

Dates render as `dd/MM/yyyy` rather than "14 thg 8, 2026" — they sit in mono
cells beside other tabular figures, and the abbreviated Vietnamese month breaks
that alignment.

### Two things Vietnamese changed in the layout

Vietnamese runs roughly 30-40% wider than the equivalent English, which the
tight mono labels feel first.

- **The header drops its wordmark below 380px.** With Vietnamese nav labels,
  brand + nav left under 16px of slack at 320px — one longer label from
  breaking. The logo mark still identifies the site.
- **Hero and 404 buttons stack full-width below 480px.** Wrapped buttons of
  different widths read as ragged; a single column gives the stack one edge.

Both fonts ship Vietnamese subsets, so headlines and mono labels keep their
typeface rather than falling back to a system font. Verified that stacked
diacritics (`XỬ LÝ`, `PHẦN MỀM`) clear the 14px line-height on 10px caps.

Run `npm run audit:layout` after editing Vietnamese copy — longer strings are
the most likely cause of a page scrolling sideways on a phone.

## Design system

Ported from `sample_designs/aether_kinetic/DESIGN.md` — warm bone surfaces,
1px structural seams, Geist for prose and JetBrains Mono for anything
technical. All tokens live at the top of `src/styles/global.css`.

**Where the spec and the reference HTML disagreed, the HTML won.** The written
spec calls for canvas `#F9F8F6` and Klein Blue `#002FA7`; the reference
implementation uses `#faf9f7` and `#3654c8`. The screenshots render the latter,
so those are the values here.

Three deliberate departures from the sample files:

- **No Tailwind.** The samples load `cdn.tailwindcss.com`, which compiles in
  the browser — ~400KB of JavaScript and a flash of unstyled content on every
  page load. The tokens are plain CSS custom properties instead. The site ships
  **zero JavaScript**.
- **Fonts are self-hosted** via `@fontsource-variable`, not Google Fonts. Two
  fewer third-party connections on first paint, and the `vietnamese` subset
  comes along automatically.
- **Desktop layouts are new.** The samples are phone mockups — six responsive
  utilities across four files, and app chrome (bottom tab bar) that a website
  should not have. Breakpoints follow the spec's grid section: 4-col to 767px,
  8-col to 1023px, 12-col above, 1440px max, gutters 1 / 1.5 / 2.5rem.

Light only, matching the reference — it defines no dark palette, and inventing
one would not be the same design.

### Writing specs so they render properly

The product page renders `specs` as the design's label/value matrix. Write them
as `Key: Value` to get the micro-caps key:

```yaml
specs:
  - 'Servos: 18 × 20 kg·cm metal-gear, pre-calibrated'
  - 'Frame: 3 mm aluminium, 380 mm span'
```

A bullet with no colon still works — the whole line becomes the value — so
imported products render fine before you restructure them.

### Checking your changes

`npm run audit:layout` walks every page at 360, 390, 768, 1280 and 1600px and
fails loudly on horizontal overflow, naming the offending element. Run it after
touching layout — a single unwrappable element scrolls the whole page sideways
on a phone, and it is invisible on a desktop monitor.

Both tools need a Chromium: they find a Playwright or system install
automatically, or set `CHROME_PATH`.

## Deploying to Cloudflare Pages

### Option A — Git integration (recommended)

Push to GitHub, then in the Cloudflare dashboard: **Workers & Pages → Create →
Pages → Connect to Git**.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | set env var `NODE_VERSION` = `22.19.0` |

Every push to `main` deploys; every pull request gets its own preview URL.

### Option B — Direct upload

```bash
npx wrangler login
npm run deploy
```

No GitHub needed, but no preview deployments either.

### After the first deploy

1. **Set your real domain.** Change `SITE` in `astro.config.mjs` (or set a
   `SITE_URL` build env var). It drives canonical URLs, `sitemap-index.xml` and
   the RSS feed — leaving it as `.pages.dev` after you attach a custom domain
   means Google indexes the wrong hostname.
2. Update the `Sitemap:` line in `public/robots.txt` to match.
3. Fill in `src/consts.ts` — contact email, Discord/GitHub links, site title.
4. Add `public/og-default.png` (1200×630) for link previews.

`public/_headers` is read by Cloudflare at the edge and already sets the
security headers plus immutable caching for hashed assets.

## Adding a forum later

Don't build one into this repo. Point people at Discord or GitHub Discussions
first — free, and where hardware communities already are. Add
[Giscus](https://giscus.app) to `ArticleLayout.astro` if you want per-post
comments backed by GitHub Discussions. Self-hosted Discourse needs ~2 GB RAM
(~$12/mo) and is only worth it once threads are pulling in search traffic.

## Structure

```
src/
├── consts.ts             # site title, nav, contact — edit this first
├── content.config.ts     # frontmatter schemas (the build-time validation)
├── content/
│   ├── products/         # one Markdown file per SKU (see sync script)
│   ├── posts/            # DIY build logs
│   └── guides/           # evergreen how-tos
├── components/           # Header, Footer, ProductCard, BuyButton, SpecGrid
├── layouts/              # BaseLayout, ArticleLayout
├── pages/                # routes; [...slug].astro are the detail pages
│   └── products/danh-muc/[category].astro   # one page per category
└── styles/global.css     # Aether Kinetic tokens + primitives
```

```
scripts/
├── sync-products.mjs           # Shopee export → product Markdown
└── example-shopee-export.csv   # sample input, for testing the above

tools/                          # optional dev utilities (need Chromium)
├── audit-layout.mjs            # horizontal-overflow check across widths
├── shoot.mjs                   # screenshot key pages
└── browser.mjs                 # locates a Chromium to drive
```

## Where the traffic will actually come from

Product pages that end in "buy this on Shopee" compete for search traffic
against Shopee's own listing for the same product, and Shopee usually wins.
Thin product pages are not the growth channel.

The guides are. *Powering servos without browning out your compute* is
something Shopee will never rank for, and it is what someone searches before
they know which part to buy. Product pages exist to convert readers who are
already here.

So: write guides, keep product pages functional but light, and cross-link
heavily between them. Both sample guides link into products and vice versa —
keep doing that.
