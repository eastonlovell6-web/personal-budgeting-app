// Renders the app icon to PNGs via headless Chrome (no image libs needed).
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ICONS = "/Users/eastonlovell/Personal Budgeting App/public/icons";
const PUBLIC = "/Users/eastonlovell/Personal Budgeting App/public";
mkdirSync(ICONS, { recursive: true });

// Full-bleed orange tile with a white ascending-bars mark. iOS applies its own
// rounded mask, so the art is edge-to-edge.
const html = (size) => `<!doctype html><html><body style="margin:0">
<div style="width:${size}px;height:${size}px;background:linear-gradient(145deg,#f2874c,#e8562a);display:flex;align-items:flex-end;justify-content:center;gap:${size*0.055}px;padding-bottom:${size*0.30}px;box-sizing:border-box">
  <div style="width:${size*0.11}px;height:${size*0.16}px;background:#fff;border-radius:${size*0.03}px"></div>
  <div style="width:${size*0.11}px;height:${size*0.28}px;background:#fff;border-radius:${size*0.03}px"></div>
  <div style="width:${size*0.11}px;height:${size*0.40}px;background:#fff;border-radius:${size*0.03}px"></div>
</div></body></html>`;

const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();

const targets = [
  [1024, `${ICONS}/icon-1024.png`],
  [512, `${ICONS}/icon-512.png`],
  [192, `${ICONS}/icon-192.png`],
  [180, `${PUBLIC}/apple-touch-icon.png`],
];
for (const [size, path] of targets) {
  await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await p.setContent(html(size), { waitUntil: "domcontentloaded" });
  await p.screenshot({ path, omitBackground: false });
  console.log("wrote", path);
}
await b.close();
