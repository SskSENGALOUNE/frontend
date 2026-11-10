import { expect, test } from "@playwright/test";
import { api, FOOD, localDate, loginAs, newUser, SALARY, periodMonth } from "./helpers";

const PAGES = ["/", "/entry", "/transactions", "/budgets", "/more", "/recurring", "/categories", "/profile"];

test.describe("15. every page at 375px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("has no horizontal scroll and no Thai text", async ({ page, request }) => {
    const s = await newUser(request);
    // realistic data so lists, charts and budgets render
    const d = localDate();
    await api(request, s, "POST", "/transactions", { type: "income", category_id: s.cat(SALARY), amount: 8500000, txn_date: d });
    await api(request, s, "POST", "/expenses", [{ category_id: s.cat(FOOD), amount: 1234567.89, txn_date: d, note: "ໝາຍເຫດຍາວໆ ".repeat(8) }]);
    await api(request, s, "PUT", "/budgets", { category_id: s.cat(FOOD), month: periodMonth(d), amount: 1000000 });

    await page.goto("/login");
    expect(await thaiText(page)).toBe("");
    await loginAs(page, s, "/");
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(scroll, `${path} scrolls sideways`).toBeLessThanOrEqual(client);
      expect(await thaiText(page), `${path} contains Thai`).toBe("");
    }
  });

  test("touch targets in the bottom bar are at least 44px", async ({ page, request }) => {
    const s = await newUser(request);
    await loginAs(page, s, "/");
    const nav = page.getByRole("navigation", { name: "ເມນູຫຼັກ" }).last();
    for (const link of await nav.getByRole("link").all()) {
      const box = (await link.boundingBox())!;
      expect(box.height, await link.innerText()).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("touch targets", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("every visible button, link and field on the main pages is at least 44px tall", async ({ page, request }) => {
    const s = await newUser(request);
    await api(request, s, "POST", "/expenses", [{ category_id: s.cat(FOOD), amount: 1000, txn_date: localDate() }]);
    await loginAs(page, s, "/");
    const small: string[] = [];
    for (const path of ["/", "/entry", "/transactions", "/budgets", "/more"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      small.push(
        ...(await page.evaluate((p) => {
          const out: string[] = [];
          for (const el of document.querySelectorAll("button, a[href], input, select")) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue; // hidden (e.g. desktop sidebar)
            if (r.height < 44) out.push(`${p} <${el.tagName.toLowerCase()}> "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(r.height)}px`);
          }
          return out;
        }, path)),
      );
    }
    expect(small).toEqual([]);
  });
});

async function thaiText(page: import("@playwright/test").Page): Promise<string> {
  const text = await page.evaluate(() => document.body.innerText + " " + [...document.querySelectorAll("[aria-label],[placeholder]")].map((e) => e.getAttribute("aria-label") ?? e.getAttribute("placeholder")).join(" "));
  return (text.match(/[฀-๿]+/g) ?? []).join(" ");
}
