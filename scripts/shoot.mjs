import puppeteer from "puppeteer-core";

const OUT = process.env.OUT || "/tmp/budget-shots";
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:3000";
const PASSCODE = "1234";

import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

// Log in
await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
await page.type('input[type="password"]', PASSCODE);
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
  page.click('button[type="submit"]'),
]);
await new Promise((r) => setTimeout(r, 1500));

const tabs = ["Income", "Spending", "Cash Flow"];
for (const label of tabs) {
  await page.evaluate((t) => {
    const btn = [...document.querySelectorAll('button[role="tab"]')].find(
      (b) => b.textContent.trim() === t
    );
    btn?.click();
  }, label);
  await new Promise((r) => setTimeout(r, 1400));
  const file = `${OUT}/${label.replace(/\s+/g, "").toLowerCase()}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log("shot", file);
}

await browser.close();
