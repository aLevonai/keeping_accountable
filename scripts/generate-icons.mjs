// Run from the project root: node scripts/generate-icons.mjs
// Requires: npm install sharp --save-dev

import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svg = readFileSync(join(root, "public/icons/icon.svg"));

mkdirSync(join(root, "public/icons"), { recursive: true });

const sizes = [
  { name: "icon-72.png",   size: 72  },
  { name: "icon-96.png",   size: 96  },
  { name: "icon-128.png",  size: 128 },
  { name: "icon-144.png",  size: 144 },
  { name: "icon-152.png",  size: 152 },
  { name: "icon-180.png",  size: 180 },
  { name: "icon-192.png",  size: 192 },
  { name: "icon-384.png",  size: 384 },
  { name: "icon-512.png",  size: 512 },
];

for (const { name, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(root, "public/icons", name));
  console.log(`✓ ${name}`);
}

// apple-touch-icon at public root (Safari "Add to Home Screen")
await sharp(svg)
  .resize(180, 180)
  .png()
  .toFile(join(root, "public/apple-touch-icon.png"));
console.log("✓ public/apple-touch-icon.png");

console.log("\nDone! Copy manifest.json to public/manifest.json");
