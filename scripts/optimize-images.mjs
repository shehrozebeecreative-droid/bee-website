// Convert every raster image the homepage references into right-sized WebP under public/bee/opt.
// Run: node scripts/optimize-images.mjs   (re-run after adding images; it rewrites nothing in code)
import sharp from "sharp";
import { mkdirSync, statSync } from "node:fs";
import { basename, extname } from "node:path";

const SRC = "public/bee";
const OUT = "public/bee/opt";
mkdirSync(OUT, { recursive: true });

// file → max width in px (≈ 2× its largest on-screen size)
const jobs = {
  "web-01-p-1080.png": 1000, "ui-01-p-1080.png": 1000, "branding-p-1080.png": 1000, "smm-p-1080.png": 1000,
  "ycm-1080-x-720-image-3.png": 1000, "custom-theme-development-1.png": 900,
  "shopify-service-image.webp": 800, "graphic-design-service-section-image-634-x-528.webp": 800,
  "digital-marketing-and-seo-service-image.webp": 800,
  "web-01-p-500.png": 420, "ui-01-p-500.png": 420, "branding-p-500.png": 420, "smm-p-500.png": 420,
  "shopify-service-image-p-500.webp": 420,
  "avatar.jpg": 160, "user-2.png": 160, "user-3.png": 160, "user-7.png": 160, "testimony-image-1.avif": 160,
};

let before = 0, after = 0;
for (const [file, width] of Object.entries(jobs)) {
  const out = `${OUT}/${basename(file, extname(file))}.webp`;
  await sharp(`${SRC}/${file}`).resize({ width, withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toFile(out);
  before += statSync(`${SRC}/${file}`).size;
  after += statSync(out).size;
}
console.log(`images: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`);
