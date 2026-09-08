/**
 * Numeric dd/MM/yyyy rather than "14 thg 8, 2026". Dates sit in mono cells
 * alongside other tabular figures, and the abbreviated Vietnamese month
 * breaks that alignment.
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

export const AVAILABILITY_LABEL = {
  'in-stock': 'Còn hàng',
  preorder: 'Đặt trước',
  'sold-out': 'Hết hàng',
} as const;

// Keys stay English — they are frontmatter values and URL segments, not
// display text. Order here is the order categories appear in the catalogue:
// finished robots first, since that is where the margin is.
export const CATEGORY_LABEL = {
  robots: 'Robot AI hoàn chỉnh',
  kits: 'Bộ kit DIY',
  boards: 'Bo mạch',
  parts: 'Phụ kiện & khác',
} as const;

/**
 * Drafts render in `astro dev` so you can preview them, and are excluded from
 * every production build. Passed straight to getCollection as a filter.
 */
export const isPublished = ({ data }: { data: { draft: boolean } }) =>
  import.meta.env.DEV || !data.draft;

/**
 * Specs are authored as `Key: Value` so the product page can render them as
 * the design's label/value matrix. Bullets without a key still work — the
 * whole line becomes the value — so older products need no rewriting.
 */
export function parseSpec(raw: string): { key: string | null; value: string } {
  const match = /^\s*([^:—]{2,28})\s*(?::|—)\s*(.+)$/.exec(raw);
  return match
    ? { key: match[1].trim(), value: match[2].trim() }
    : { key: null, value: raw.trim() };
}

/**
 * Flat catalogue ordering. Category rank comes first so items of the same kind
 * stay adjacent in a single grid — the grouping reads visually without needing
 * a heading per category, which looks broken when a category holds one item.
 * Within a category, the author-set `order` wins, then title.
 */
export function sortProducts<T extends { data: { category: keyof typeof CATEGORY_LABEL; order: number; title: string } }>(
  products: T[],
): T[] {
  const rank = Object.keys(CATEGORY_LABEL) as Array<keyof typeof CATEGORY_LABEL>;
  return [...products].sort(
    (a, b) =>
      rank.indexOf(a.data.category) - rank.indexOf(b.data.category) ||
      a.data.order - b.data.order ||
      a.data.title.localeCompare(b.data.title, 'vi'),
  );
}
