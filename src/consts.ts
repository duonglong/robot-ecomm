// Single place for site-wide strings. Change these, not the templates.
// Matches the Shopee shop name. Change here and it updates everywhere.
export const SITE_TITLE = 'Shop Đồ Chơi AI';
export const SITE_DESCRIPTION =
  'Robot AI dùng được ngay, bộ kit DIY và bo mạch ESP32 — kèm hướng dẫn nạp firmware Xiaozhi cho từng dòng bo.';

// Shown in the footer and used as the reply-to for order questions.
export const CONTACT_EMAIL = 'hello@example.com';

// Checkout lives on a marketplace for now. Fill SHOP_URL in and every product
// button activates at once, pointing at the shop; a product with its own
// `buyUrl` overrides it with a deep link to that listing.
// Leave it empty and buttons stay disabled — safer than shipping a dead link.
export const SHOP_URL = 'https://shopee.vn/nguyenduchuy970';
export const SHOP_NAME = 'Shopee';

// Community links. Empty string hides the link.
export const DISCORD_URL = '';
export const GITHUB_URL = '';

// Shown as the footer's right-hand meta. Leave empty to hide the line rather
// than ship a placeholder location.
export const SHIPS_FROM = '';

export const NAV = [
  { href: '/', label: 'Sản phẩm' },
  { href: '/firmware/', label: 'Firmware' },
  { href: '/guides/', label: 'Hướng dẫn' },
  { href: '/blog/', label: 'Nhật ký' },
] as const;
