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
  const shapeOptions = await page.locator("#shape-mode option").evaluateAll(options => options.map(option => option.value));
  for (const [value, label] of [["polyhedron", "Polyhedral core"], ["torus", "Torus knot"], ["crystal", "Crystal cluster"], ["helix", "Helix array"]]) {
    if (!shapeOptions.includes(value)) throw new Error("Missing sculpture preset: " + value);
    await page.locator("#shape-mode").selectOption(value);
    if (!(await page.locator("#scene-state").innerText()).includes(label)) throw new Error("Sculpture selector failed for " + label);
    const mode = await page.evaluate(() => window.synced3D.renderers.map(view => view.object.userData.mode));
    if (mode.some(current => current !== value)) throw new Error("Sculpture preset did not synchronize across cameras: " + value);
  }
  await page.getByRole("button", { name: "Wireframe" }).click();
  const wireframeVisible = await page.evaluate(() => window.synced3D.renderers.map(view => view.object.userData.wires.length > 0 && view.object.userData.wires.every(wire => wire.visible)));
  if (wireframeVisible.some(visible => !visible)) throw new Error("Wireframe overlays did not become visible in every camera");
  if (!(await page.getByRole("button", { name: "Wireframe on" }).isVisible())) throw new Error("Wireframe button state failed");
  await page.getByRole("button", { name: "Grid on" }).click();
  const gridHidden = await page.evaluate(() => window.synced3D.renderers.every(view => !view.floor.visible));
  if (!gridHidden) throw new Error("Grid remained visible in one or more cameras");
  if (!(await page.getByRole("button", { name: "Grid off" }).isVisible())) throw new Error("Grid button state failed");

  await page.locator("#speed").evaluate(el => {
    el.value = "0";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const satelliteBefore = await page.evaluate(() => {
    const satellite = window.synced3D.renderers[0].object.userData.satellites[0];
    return [satellite.rotation.x, satellite.rotation.y];
  });
  await page.waitForTimeout(350);
  const satelliteAfter = await page.evaluate(() => {
    const satellite = window.synced3D.renderers[0].object.userData.satellites[0];
    return [satellite.rotation.x, satellite.rotation.y];
  });
  if (satelliteBefore.some((value, i) => Math.abs(value - satelliteAfter[i]) > 0.00001)) throw new Error("Satellites moved at zero speed");

  await page.locator("#shape-mode").focus();
  await page.keyboard.press("Space");
  if (!(await page.getByRole("button", { name: "Pause motion" }).isVisible())) throw new Error("Space on the focused dropdown unexpectedly paused motion");
  await page.keyboard.press("R");
  if ((await page.locator("#shape-mode").inputValue()) !== "helix") throw new Error("R on the focused dropdown unexpectedly reset the scene");

  await page.getByRole("button", { name: "Reset scene" }).click();
  const resetState = await page.evaluate(() => ({
    mode: window.synced3D.state.shapeMode,
    speed: window.synced3D.state.speed,
    wireframe: window.synced3D.state.wireframe,
    showGrid: window.synced3D.state.showGrid,
    floors: window.synced3D.renderers.every(view => view.floor.visible),
    wires: window.synced3D.renderers.every(view => view.object.userData.wires.every(wire => !wire.visible))
  }));
  if (resetState.mode !== "polyhedron" || resetState.speed !== 1 || resetState.wireframe || !resetState.showGrid || !resetState.floors || !resetState.wires) {
    throw new Error("Reset did not restore default scene state: " + JSON.stringify(resetState));
  }
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
