// Mobile Lighthouse for logged-in pages. Run through the e2e runner so it only ever talks to the
// throwaway test backend:  E2E_CMD="node scripts/lighthouse.mjs" ./scripts/e2e.sh
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";

const PORT = 13001;
const BASE = `http://localhost:${PORT}`;
const CDP = 9333;
const PAGES = ["/login", "/", "/entry", "/transactions", "/budgets"];

const server = spawn("npx", ["next", "start", "-p", String(PORT)], { env: { ...process.env, NEXT_DIST_DIR: ".next-e2e" }, stdio: "ignore" });
const stop = () => server.kill();
process.on("exit", stop);

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`not up: ${url}`);
}

async function call(token, method, path, body) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()).data;
}

await waitFor(`${BASE}/login`);

// seed a realistic month
const { token } = await call(null, "POST", "/auth/register", { name: "Lighthouse", email: `lh-${Date.now()}@test.la`, password: "secret123" });
const cats = await call(token, "GET", "/categories");
const id = (name) => cats.find((c) => c.name === name).id;
const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const day = (n) => `${today.slice(0, 8)}${String(n).padStart(2, "0")}`;
await call(token, "POST", "/transactions", { type: "income", category_id: id("ເງິນເດືອນ"), amount: 8500000, txn_date: day(1) });
const exp = [];
for (let d = 1; d <= Number(today.slice(8)); d++) {
  exp.push({ category_id: id("ອາຫານ ແລະ ເຄື່ອງດື່ມ"), amount: 30000 + d * 1000, txn_date: day(d) });
  if (d % 3 === 0) exp.push({ category_id: id("ຄ່າເດີນທາງ"), amount: 25000, txn_date: day(d) });
}
await call(token, "POST", "/expenses", exp);
await call(token, "PUT", "/budgets", { category_id: id("ອາຫານ ແລະ ເຄື່ອງດື່ມ"), month: today.slice(0, 7), amount: 1500000 });

const userDataDir = `/tmp/mm-lh-${Date.now()}`;
const ctx = await chromium.launchPersistentContext(userDataDir, { channel: "chrome", headless: true, args: [`--remote-debugging-port=${CDP}`] });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);

const results = {};
for (const path of PAGES) {
  // /login is measured logged out; the rest logged in
  await page.evaluate((t) => (t ? localStorage.setItem("mm_token", t) : localStorage.removeItem("mm_token")), path === "/login" ? null : token);
  const r = await lighthouse(`${BASE}${path}`, {
    port: CDP,
    disableStorageReset: true,
    onlyCategories: ["performance", "accessibility", "best-practices"],
    formFactor: "mobile",
    output: "json",
    logLevel: "error",
  });
  const c = r.lhr.categories;
  const failed = Object.values(r.lhr.audits)
    .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode === "binary")
    .map((a) => a.id);
  results[path] = {
    performance: Math.round(c.performance.score * 100),
    accessibility: Math.round(c.accessibility.score * 100),
    bestPractices: Math.round(c["best-practices"].score * 100),
    lcpMs: Math.round(r.lhr.audits["largest-contentful-paint"].numericValue),
    cls: +r.lhr.audits["cumulative-layout-shift"].numericValue.toFixed(3),
    fcpMs: Math.round(r.lhr.audits["first-contentful-paint"].numericValue),
    tbtMs: Math.round(r.lhr.audits["total-blocking-time"].numericValue),
    siMs: Math.round(r.lhr.audits["speed-index"].numericValue),
    failedAudits: failed,
  };
  console.log(path, results[path]);
}

mkdirSync("../docs", { recursive: true });
writeFileSync("../docs/lighthouse.json", JSON.stringify(results, null, 2));
await ctx.close();
stop();
process.exit(0);
