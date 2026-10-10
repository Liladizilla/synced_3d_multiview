import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const path = normalize(join(root, pathname === "/" ? "index.html" : pathname));
    if (!path.startsWith(root)) { res.writeHead(403).end("Forbidden"); return; }
    const body = await readFile(path);
    res.writeHead(200, { "content-type": mime[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404).end("Not found"); }
});

const errors = [];
let browser;
try {
  await new Promise(resolve => server.listen(4173, "127.0.0.1", resolve));
  browser = await chromium.launch({ headless: true, args: ["--use-gl=swiftshader", "--enable-webgl"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle", timeout: 45000 });
  await page.locator("#view-orbit canvas").waitFor({ timeout: 20000 });
  await page.locator("#view-front canvas").waitFor({ timeout: 10000 });
  await page.locator("#view-top canvas").waitFor({ timeout: 10000 });
  if (await page.locator(".viewport canvas").count() !== 3) throw new Error("Expected exactly three rendered camera views");
  if (!(await page.locator("#status").innerText()).includes("ALL SYSTEMS LIVE")) throw new Error("Scene did not reach ready state");
  await page.getByRole("button", { name: "Pause motion" }).click();
  if (!(await page.getByRole("button", { name: "Resume motion" }).isVisible())) throw new Error("Pause control failed");
  await page.getByRole("button", { name: "Resume motion" }).click();
  await page.getByRole("button", { name: "Reset scene" }).click();
  await page.locator("#shape-mode").selectOption("crystal");
  if (!(await page.locator("#scene-state").innerText()).includes("Crystal cluster")) throw new Error("Sculpture selector failed");
  await page.getByRole("button", { name: "Wireframe" }).click();
  if (!(await page.getByRole("button", { name: "Wireframe on" }).isVisible())) throw new Error("Wireframe toggle failed");
  await page.getByRole("button", { name: "Grid on" }).click();
  if (!(await page.getByRole("button", { name: "Grid off" }).isVisible())) throw new Error("Grid toggle failed");
  await page.getByRole("button", { name: "Reset scene" }).click();
  await page.locator("#speed").evaluate(el => {
    el.value = "2";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  if (!(await page.locator("#speed-value").innerText()).includes("2.0")) throw new Error("Speed control failed");
  if (errors.length) throw new Error("Browser errors: " + errors.join("; "));
  console.log("PASS: page loads, three canvases render, controls work, and no uncaught browser errors occurred.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
