#!/usr/bin/env node
/**
 * Generate placeholder product artwork as SVG.
 *
 * These are schematic illustrations in the Aether Kinetic palette, not
 * photographs — they exist so the catalogue reads as designed before real
 * product photos exist. Replace them: a photo of the actual board sells it,
 * a drawing does not.
 *
 * No text is drawn. An SVG used as an <img> cannot load the site's webfonts,
 * so any label would render in a fallback mono and break the type system.
 *
 * Usage: node tools/gen-product-art.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'src/assets/products';

// Palette, matching src/styles/global.css.
const C = {
  bg: '#efeeec',
  board: '#e3e2e0',
  boardEdge: '#c7c6cb',
  ink: '#1a1c1b',
  ink60: '#76777b',
  blue: '#3654c8',
  amber: '#d36400',
  light: '#faf9f7',
};

const W = 1200;
const H = 900;

/** Faint technical grid + corner registration marks. */
function frame() {
  const lines = [];
  for (let x = 0; x <= W; x += 60) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${C.boardEdge}" stroke-width="1" opacity="0.28"/>`);
  }
  for (let y = 0; y <= H; y += 60) {
    lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${C.boardEdge}" stroke-width="1" opacity="0.28"/>`);
  }
  const m = 48, len = 26;
  const marks = [
    [m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1],
  ].map(([x, y, dx, dy]) =>
    `<path d="M${x} ${y + dy * len} L${x} ${y} L${x + dx * len} ${y}" fill="none" stroke="${C.ink60}" stroke-width="2"/>`,
  );
  return lines.join('') + marks.join('');
}

/** A row of header pins along an edge. */
function pins(x, y, count, step, vertical = false, r = 5) {
  return Array.from({ length: count }, (_, i) => {
    const cx = vertical ? x : x + i * step;
    const cy = vertical ? y + i * step : y;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.light}" stroke="${C.ink}" stroke-width="2.5"/>`;
  }).join('');
}

/** The ESP32 module can: shield outline plus a meander antenna. */
function module(x, y, w, h) {
  const ax = x + w / 2 - 60;
  const ay = y + h + 14;
  let ant = `M${ax} ${ay}`;
  for (let i = 0; i < 6; i++) {
    const bx = ax + i * 20;
    ant += ` L${bx} ${ay + (i % 2 ? 0 : 22)} L${bx + 10} ${ay + (i % 2 ? 0 : 22)}`;
  }
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${C.ink}"/>
    <rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="2" fill="none" stroke="${C.light}" stroke-width="1.5" opacity="0.35"/>
    <path d="${ant}" fill="none" stroke="${C.ink}" stroke-width="7" stroke-linecap="square"/>`;
}

/** USB-C receptacle seen end-on. */
function usbc(x, y, w = 96, h = 34) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${C.ink60}"/>
    <rect x="${x + 12}" y="${y + 11}" width="${w - 24}" height="${h - 22}" rx="6" fill="${C.bg}"/>`;
}

function board(x, y, w, h, extra = '') {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${C.board}" stroke="${C.boardEdge}" stroke-width="2"/>
    ${extra}`;
}

function svg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${frame()}
${inner}
</svg>
`;
}

// ---------------------------------------------------------------- artwork ---

const art = {};

// Full-size S3 board: module, mic, USB-C, two pin rows, status LED.
art['esp32-s3-mach-tim'] = svg(`
  ${board(320, 210, 560, 480)}
  ${module(400, 250, 260, 150)}
  <circle cx="790" cy="320" r="34" fill="${C.ink}"/>
  <circle cx="790" cy="320" r="14" fill="${C.bg}"/>
  <circle cx="790" cy="320" r="5" fill="${C.ink}"/>
  <rect x="700" y="430" width="120" height="80" rx="4" fill="${C.ink60}"/>
  ${usbc(552, 660)}
  <circle cx="370" cy="640" r="9" fill="${C.blue}"/>
  ${pins(360, 250, 9, 40, true)}
  ${pins(840, 250, 9, 40, true)}`);

// Super Mini: same silhouette, much smaller, no mic.
art['esp32-s3-super-mini'] = svg(`
  ${board(455, 300, 290, 300)}
  ${module(490, 330, 220, 130)}
  ${usbc(552, 570, 96, 30)}
  <circle cx="495" cy="520" r="8" fill="${C.blue}"/>
  ${pins(478, 340, 6, 40, true, 6)}
  ${pins(722, 340, 6, 40, true, 6)}`);

// S3 with a round TFT: display dominates, board peeks out behind.
art['esp32-s3-man-hinh-tron'] = svg(`
  ${board(390, 240, 420, 420)}
  ${pins(415, 690, 7, 42)}
  <circle cx="600" cy="450" r="185" fill="${C.ink}"/>
  <circle cx="600" cy="450" r="168" fill="#0f1011"/>
  <circle cx="600" cy="450" r="120" fill="none" stroke="${C.blue}" stroke-width="6" opacity="0.85"/>
  <circle cx="600" cy="450" r="78" fill="none" stroke="${C.light}" stroke-width="3" opacity="0.4"/>
  <circle cx="600" cy="450" r="14" fill="${C.amber}"/>`);

// C3: smallest board, RISC-V, fewest pins.
art['esp32-c3-mini'] = svg(`
  ${board(500, 340, 200, 220)}
  ${module(525, 362, 150, 96)}
  ${usbc(566, 530, 68, 26)}
  <circle cx="537" cy="500" r="7" fill="${C.amber}"/>
  ${pins(520, 372, 4, 40, true, 5)}
  ${pins(680, 372, 4, 40, true, 5)}`);

// Kit: exploded set — board, mic, amp, speaker, battery.
art['kit-loa-tro-ly-xiaozhi'] = svg(`
  ${board(150, 250, 330, 300)}
  ${module(185, 285, 230, 130)}
  ${usbc(266, 505, 90, 30)}
  <circle cx="205" cy="460" r="8" fill="${C.blue}"/>

  <circle cx="880" cy="360" r="150" fill="${C.ink}"/>
  <circle cx="880" cy="360" r="112" fill="${C.board}"/>
  <circle cx="880" cy="360" r="74" fill="${C.ink}"/>
  <circle cx="880" cy="360" r="30" fill="${C.bg}"/>

  ${board(560, 590, 170, 130)}
  <rect x="592" y="620" width="106" height="52" rx="3" fill="${C.ink}"/>
  ${pins(580, 700, 4, 36)}

  ${board(790, 600, 250, 120, `<rect x="820" y="630" width="190" height="60" rx="6" fill="${C.ink60}"/>`)}

  ${board(180, 610, 240, 110)}
  <circle cx="240" cy="665" r="26" fill="${C.ink}"/>
  <circle cx="240" cy="665" r="10" fill="${C.bg}"/>
  <circle cx="240" cy="665" r="3" fill="${C.ink}"/>`);

// INMP441 breakout: port hole plus a single 6-pin header.
art['mic-i2s-inmp441'] = svg(`
  ${board(455, 300, 290, 300)}
  <rect x="510" y="345" width="180" height="140" rx="6" fill="${C.ink}"/>
  <circle cx="600" cy="415" r="30" fill="${C.bg}"/>
  <circle cx="600" cy="415" r="11" fill="${C.ink}"/>
  <path d="M540 520 H660" stroke="${C.ink60}" stroke-width="4" stroke-linecap="round"/>
  ${pins(485, 570, 6, 46)}`);

// MAX98357A amp plus a speaker cone.
art['amp-i2s-max98357a'] = svg(`
  ${board(230, 320, 280, 260)}
  <rect x="272" y="358" width="196" height="104" rx="4" fill="${C.ink}"/>
  <rect x="286" y="372" width="168" height="76" rx="2" fill="none" stroke="${C.light}" stroke-width="1.5" opacity="0.3"/>
  ${pins(262, 540, 6, 42)}
  <path d="M520 430 H600" stroke="${C.ink60}" stroke-width="5" stroke-linecap="round"/>
  <path d="M520 470 H600" stroke="${C.ink60}" stroke-width="5" stroke-linecap="round"/>

  <circle cx="830" cy="450" r="190" fill="${C.ink}"/>
  <circle cx="830" cy="450" r="150" fill="${C.board}"/>
  <circle cx="830" cy="450" r="112" fill="${C.ink}"/>
  <circle cx="830" cy="450" r="60" fill="${C.bg}"/>
  <circle cx="830" cy="450" r="22" fill="${C.amber}"/>`);

mkdirSync(OUT, { recursive: true });
for (const [name, content] of Object.entries(art)) {
  writeFileSync(`${OUT}/${name}.svg`, content);
  console.log(`  ${name}.svg  ${(content.length / 1024).toFixed(1)} kB`);
}
console.log(`\n${Object.keys(art).length} illustrations written to ${OUT}/`);
