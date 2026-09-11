/**
 * Render personalised PRO delivery PDF for entry 56657 (Package B).
 *   node scripts/render-delivery-56657.mjs
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const htmlPath = join(root, "output", "reports", "gw4-56657-b49.html");
const pdfPath = join(root, "output", "reports", "gw4-56657-b49.pdf");

async function main() {
  mkdirSync(dirname(pdfPath), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`, {
      waitUntil: "load",
    });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });
    console.log("wrote", pdfPath);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
