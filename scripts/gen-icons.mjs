/**
 * Generates the PWA icons with zero image dependencies: a tiny RGBA PNG encoder
 * on top of node:zlib, drawing the "days unfixed" motif — three ascending bars
 * on civic red.
 *
 * Run: node scripts/gen-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RED = [217, 43, 31];
const WHITE = [255, 255, 255];

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function canvas(size) {
  const buf = Buffer.alloc(size * size * 4); // transparent
  const put = (x, y, [r, g, b], alpha = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = alpha;
  };
  return { buf, put };
}

/** Anti-aliased rounded rectangle fill via 2x2 supersampling per pixel. */
function roundedRect(size, put, x0, y0, x1, y1, radius, colour) {
  const inside = (px, py) => {
    const rx = Math.min(Math.max(px, x0 + radius), x1 - radius);
    const ry = Math.min(Math.max(py, y0 + radius), y1 - radius);
    return (px - rx) ** 2 + (py - ry) ** 2 <= radius ** 2;
  };
  for (let y = Math.floor(y0); y < Math.ceil(y1); y += 1) {
    for (let x = Math.floor(x0); x < Math.ceil(x1); x += 1) {
      let hits = 0;
      for (const dx of [0.25, 0.75]) for (const dy of [0.25, 0.75]) if (inside(x + dx, y + dy)) hits += 1;
      if (hits > 0) put(x, y, colour, Math.round((hits / 4) * 255));
    }
  }
}

function bars(size, put, colour, scale = 1) {
  const cx = size / 2;
  const baseY = size * (0.5 + 0.17 * scale);
  const unit = size * 0.14 * scale;
  const barW = unit * 0.52;
  const gap = unit * 0.26;
  const totalW = barW * 3 + gap * 2;
  const startX = cx - totalW / 2;
  const heights = [unit * 0.62, unit * 1.0, unit * 1.38];

  heights.forEach((h, i) => {
    const x = startX + i * (barW + gap);
    roundedRect(size, put, x, baseY - h, x + barW, baseY, barW * 0.28, colour);
  });
}

function build(size, { maskable = false, rounded = true } = {}) {
  const { buf, put } = canvas(size);

  if (rounded && !maskable) {
    roundedRect(size, put, 0, 0, size, size, size * 0.22, RED);
  } else {
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) put(x, y, RED);
  }

  // Maskable icons must keep their content inside the 80% safe circle.
  bars(size, put, WHITE, maskable ? 0.72 : 1);
  return encodePng(size, buf);
}

const outDir = join(process.cwd(), "public", "icons");
mkdirSync(outDir, { recursive: true });

const outputs = [
  ["icon-192.png", build(192)],
  ["icon-512.png", build(512)],
  ["maskable-512.png", build(512, { maskable: true })],
  ["apple-touch-icon.png", build(180, { rounded: false })],
  ["favicon-32.png", build(32)],
];

for (const [name, buffer] of outputs) {
  writeFileSync(join(outDir, name), buffer);
  console.log(`  ${name.padEnd(24)} ${buffer.length} bytes`);
}
console.log("icons written to public/icons");
