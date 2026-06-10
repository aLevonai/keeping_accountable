# PWA Icons & Manifest — Together App

## Your job
Create the app icon set and `manifest.json` for the Together PWA so it can be installed on iPhone via Safari "Add to Home Screen".

**Working directory:** `C:\Users\amit\OneDrive\vibecode\keeping_accountable\keeping_accountable`

---

## Step 1 — Create the master SVG icon

Create `public/icons/icon.svg` with this design:

- **Shape:** Rounded square (the full 512×512 canvas — iOS will clip it to a rounded rect automatically)
- **Background:** `#C4704F` (terracotta — the app's primary color)
- **Foreground:** Two overlapping soft circles in `rgba(255,255,255,0.15)` to suggest "two people / together", plus the letter `T` centred in white, using a serif italic style
- **Exact SVG to use:**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <!-- Background -->
  <rect width="512" height="512" fill="#C4704F"/>

  <!-- Two soft overlapping circles (the "together" motif) -->
  <circle cx="196" cy="210" r="130" fill="rgba(255,255,255,0.10)"/>
  <circle cx="316" cy="210" r="130" fill="rgba(255,255,255,0.10)"/>

  <!-- Letter T — bold, centred -->
  <text
    x="256"
    y="308"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-style="italic"
    font-size="220"
    font-weight="400"
    fill="white"
    opacity="0.95"
  >T</text>
</svg>
```

---

## Step 2 — Generate PNG icons from the SVG

Install sharp if not already present, then run a generation script:

```bash
npm install sharp --save-dev
```

Create `scripts/generate-icons.mjs`:

```js
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
  { name: "icon-180.png",  size: 180 },  // Apple touch icon
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

// Also write apple-touch-icon.png at root of public (Safari looks here)
await sharp(svg)
  .resize(180, 180)
  .png()
  .toFile(join(root, "public/apple-touch-icon.png"));
console.log("✓ apple-touch-icon.png");
```

Run it:

```bash
node scripts/generate-icons.mjs
```

Verify the output — you should see these files created:
```
public/
  apple-touch-icon.png          ← Safari "Add to Home Screen" uses this
  icons/
    icon-72.png
    icon-96.png
    icon-128.png
    icon-144.png
    icon-152.png
    icon-180.png
    icon-192.png
    icon-384.png
    icon-512.png
```

---

## Step 3 — Create `public/manifest.json`

```json
{
  "name": "Together",
  "short_name": "Together",
  "description": "Track your goals together",
  "start_url": "/home",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F8F4F0",
  "theme_color": "#C4704F",
  "icons": [
    { "src": "/icons/icon-72.png",  "sizes": "72x72",   "type": "image/png" },
    { "src": "/icons/icon-96.png",  "sizes": "96x96",   "type": "image/png" },
    { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-180.png", "sizes": "180x180", "type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

---

## Step 4 — Add apple-touch-icon link tag to layout

Open `src/app/layout.tsx`. The `appleWebApp` metadata block already exists. Add one more field to it so Safari finds the icon:

Find the `metadata` export and update `appleWebApp` to include the icon:

```ts
export const metadata: Metadata = {
  title: "Together",
  description: "Track your goals together",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Together",
    startupImage: [],
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};
```

---

## Step 5 — Verify

Run the dev server and open `http://localhost:3000/manifest.json` in a browser — you should see the JSON. Open `http://localhost:3000/icons/icon-192.png` — you should see the icon.

Run a TypeScript check to confirm nothing broke:
```bash
npx tsc --noEmit
```

---

## What NOT to do
- Do not change any page logic, hooks, or Supabase calls
- Do not modify `next.config.ts` — PWA is already configured with `@ducanh2912/next-pwa`
- Do not add any new npm packages beyond `sharp`
- The service worker (`public/sw.js`) already exists — do not overwrite it

---

## Design tokens for reference (if you need to tweak the icon)
| Token | Value |
|---|---|
| Background (app) | `#F8F4F0` |
| Primary / accent | `#C4704F` |
| Foreground | `#1C1713` |
| Surface | `#FFFFFF` |
