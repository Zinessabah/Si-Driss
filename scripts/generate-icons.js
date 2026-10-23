import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xFF];
  }
  return (c ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function createPng(width, height, isMaskable = false) {
  // Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit depth
  ihdr[9] = 6; // color type 6: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data with filter byte 0 at start of each scanline
  const scanlineWidth = width * 4 + 1;
  const raw = Buffer.alloc(scanlineWidth * height);

  const cx = width / 2;
  const cy = height / 2;
  const maxR = width / 2;
  const safeR = maxR * (isMaskable ? 0.72 : 0.88);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineWidth;
    raw[rowOffset] = 0; // filter byte: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Deep navy-slate background #020617
      let r = 2;
      let g = 6;
      let b = 23;
      let a = 255;

      // Outer glowing ring
      if (dist >= safeR - 10 && dist <= safeR + 4) {
        // Amber gold border #f59e0b
        r = 245;
        g = 158;
        b = 11;
      } else if (dist < safeR - 10) {
        // Subtle radial gradient inside circle
        const factor = (safeR - dist) / safeR;
        r = Math.min(255, Math.floor(15 + 25 * factor));
        g = Math.min(255, Math.floor(23 + 30 * factor));
        b = Math.min(255, Math.floor(42 + 40 * factor));

        // Center stylized icon emblem: Atom orbit ellipse + center core
        const angle = Math.atan2(dy, dx);
        // Ellipse 1 tilted 45 deg
        const rotX1 = dx * 0.707 + dy * 0.707;
        const rotY1 = -dx * 0.707 + dy * 0.707;
        const ellipse1 = (rotX1 * rotX1) / ((safeR * 0.7) ** 2) + (rotY1 * rotY1) / ((safeR * 0.25) ** 2);

        // Ellipse 2 tilted -45 deg
        const rotX2 = dx * 0.707 - dy * 0.707;
        const rotY2 = dx * 0.707 + dy * 0.707;
        const ellipse2 = (rotX2 * rotX2) / ((safeR * 0.7) ** 2) + (rotY2 * rotY2) / ((safeR * 0.25) ** 2);

        if (Math.abs(ellipse1 - 1.0) < 0.12 || Math.abs(ellipse2 - 1.0) < 0.12) {
          // Cyan/Blue orbital glow #38bdf8
          r = 56;
          g = 189;
          b = 248;
        }

        // Center golden nucleus
        if (dist <= safeR * 0.28) {
          // Radiant amber #fbbf24
          r = 251;
          g = 191;
          b = 36;
        }
      }

      raw[pxOffset] = r;
      raw[pxOffset + 1] = g;
      raw[pxOffset + 2] = b;
      raw[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(raw, { level: 9 });
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Generate PNGs
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPng(64, 64, false));

// 2. Generate SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#fbbf24"/>
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <rect width="512" height="512" rx="128" fill="url(#bgGrad)"/>
  <circle cx="256" cy="256" r="236" fill="none" stroke="url(#goldGrad)" stroke-width="8" opacity="0.4"/>
  <circle cx="256" cy="256" r="220" fill="none" stroke="#1e293b" stroke-width="2"/>

  <!-- Orbits -->
  <g transform="translate(256, 256)">
    <!-- Orbit 1 -->
    <ellipse rx="170" ry="60" fill="none" stroke="url(#cyanGrad)" stroke-width="8" transform="rotate(-30)" stroke-dasharray="10 5" opacity="0.85"/>
    <circle cx="147" cy="-85" r="10" fill="#38bdf8" filter="url(#glow)"/>

    <!-- Orbit 2 -->
    <ellipse rx="170" ry="60" fill="none" stroke="url(#cyanGrad)" stroke-width="8" transform="rotate(30)" stroke-dasharray="10 5" opacity="0.85"/>
    <circle cx="-147" cy="-85" r="10" fill="#38bdf8" filter="url(#glow)"/>

    <!-- Center Badge -->
    <circle cx="0" cy="0" r="76" fill="url(#goldGrad)" filter="url(#glow)"/>
    <circle cx="0" cy="0" r="66" fill="#020617"/>

    <!-- Prof Driss SD Monogram -->
    <text x="0" y="20" font-family="system-ui, -apple-system, sans-serif" font-size="58" font-weight="900" fill="url(#goldGrad)" text-anchor="middle" letter-spacing="-2">SD</text>
  </g>

  <!-- Subtitle -->
  <text x="256" y="445" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#f8fafc" text-anchor="middle" letter-spacing="4">SI DRISS</text>
  <text x="256" y="475" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="#38bdf8" text-anchor="middle" letter-spacing="2">2ÈME BAC PC</text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');
console.log('Icons generated successfully in /public');
