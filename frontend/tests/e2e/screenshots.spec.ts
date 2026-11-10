import { mkdirSync } from "node:fs";
import { test } from "@playwright/test";
import { api, FOOD, localDate, loginAs, newUser, SALARY, TRANSPORT, periodMonth } from "./helpers";

// Not part of the normal run: SCREENSHOTS=1 ./scripts/e2e.sh screenshots --project=mobile
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture docs/screenshots");

const OUT = "../docs/screenshots";

for (const scheme of ["light", "dark"] as const) {
  test.describe(scheme, () => {
    test.use({ viewport: { width: 375, height: 812 }, colorScheme: scheme });

    test(`capture all pages (${scheme})`, async ({ page, request }) => {
      mkdirSync(OUT, { recursive: true });
      const s = await newUser(request);
      const d = localDate();
      const day = (n: number) => `${d.slice(0, 8)}${String(n).padStart(2, "0")}`;
      const days = Number(d.slice(8));
      await api(request, s, "POST", "/transactions", { type: "income", category_id: s.cat(SALARY), amount: 8500000, txn_date: day(1) });
      const exp = [];
      for (let i = 1; i <= days; i++) {
        exp.push({ category_id: s.cat(FOOD), amount: 25000 + ((i * 7919) % 40) * 1000, txn_date: day(i), note: i % 4 === 0 ? "ເຂົ້າປຽກ" : undefined });
        if (i % 2 === 0) exp.push({ category_id: s.cat(TRANSPORT), amount: 20000, txn_date: day(i) });
        if (i % 5 === 0) exp.push({ category_id: s.cat("ຊື້ເຄື່ອງ"), amount: 150000, txn_date: day(i) });
      }
      await api(request, s, "POST", "/expenses", exp.map((e) => (e.note ? e : { ...e, note: undefined })));
      await api(request, s, "PUT", "/budgets", { category_id: s.cat(FOOD), month: periodMonth(d), amount: 1200000 });
      await api(request, s, "PUT", "/budgets", { category_id: s.cat(TRANSPORT), month: periodMonth(d), amount: 400000 });
      await api(request, s, "PUT", "/budgets", { category_id: s.cat("ຊື້ເຄື່ອງ"), month: periodMonth(d), amount: 300000 });
      await api(request, s, "POST", "/recurring", { type: "income", category_id: s.cat(SALARY), amount: 8500000, frequency: "monthly", start_date: `${d.slice(0, 7)}-25` < d ? `${d.slice(0, 7)}-25` : day(25 > days ? days : 25), note: "ເງິນເດືອນ" });

      const shot = async (name: string) => {
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${OUT}/${name}-${scheme}.png`, fullPage: true });
      };

      await page.goto("/login");
      await shot("01-login");
      await loginAs(page, s, "/");
      await shot("02-overview");
      await page.goto("/entry");
      await page.getByLabel("ຈຳນວນເງິນ").fill("45000");
      await page.getByRole("radio", { name: FOOD }).click();
      await page.getByRole("button", { name: "ເພີ່ມໃສ່ລາຍການ" }).click();
      await page.getByLabel("ຈຳນວນເງິນ").fill("20000");
      await page.getByRole("radio", { name: TRANSPORT }).click();
      await shot("03-entry");
      await page.goto("/transactions");
      await shot("04-transactions");
      await page.getByTestId("txn-list").getByRole("button").first().click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/05-edit-sheet-${scheme}.png` });
      await page.goto("/budgets");
      await shot("06-budgets");
      await page.goto("/more");
      await shot("07-more");
      await page.goto("/recurring");
      await shot("08-recurring");
      await page.goto("/categories");
      await shot("09-categories");
      await page.getByRole("button", { name: FOOD }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/10-category-sheet-${scheme}.png` });
      await page.goto("/profile");
      await shot("11-profile");
    });
  });
}
