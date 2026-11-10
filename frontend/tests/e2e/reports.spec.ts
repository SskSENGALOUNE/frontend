import { expect, test } from "@playwright/test";
import { api, FOOD, localDate, loginAs, monthOffset, newUser, periodMonth, SALARY, TRANSPORT } from "./helpers";

test("6. overview numbers match what was entered @desktop", async ({ page, request }) => {
  const s = await newUser(request);
  const d = localDate();
  await api(request, s, "POST", "/transactions", { type: "income", category_id: s.cat(SALARY), amount: 5000000, txn_date: d });
  await api(request, s, "POST", "/expenses", [
    { category_id: s.cat(FOOD), amount: 75000, txn_date: d },
    { category_id: s.cat(TRANSPORT), amount: 25000, txn_date: d },
  ]);
  await api(request, s, "PUT", "/budgets", { category_id: s.cat(FOOD), month: periodMonth(d), amount: 100000 });
  await loginAs(page, s, "/");

  await expect(page.getByTestId("total-income")).toHaveText("5,000,000");
  await expect(page.getByTestId("total-expense")).toHaveText("100,000");
  await expect(page.getByTestId("net")).toHaveText("4,900,000");
  // top categories: 75% food, 25% transport
  const top = page.locator("section", { hasText: "ໃຊ້ຫຼາຍສຸດ" });
  await expect(top.getByText("75%")).toBeVisible();
  await expect(top.getByText("25%")).toBeVisible();
  // budget: 75,000 of 100,000 used
  const budget = page.locator("section", { has: page.getByRole("heading", { name: "ງົບປະມານ" }) });
  await expect(budget.getByText("ເຫຼືອ 25,000")).toBeVisible();
});

test("8. going over budget turns the bar red and shows the overage", async ({ page, request }) => {
  const s = await newUser(request);
  await loginAs(page, s, "/budgets");

  await page.getByRole("button", { name: new RegExp(FOOD) }).click();
  await page.getByLabel("ງົບປະມານ").fill("50000");
  await page.getByRole("button", { name: "ບັນທຶກງົບ" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ຕັ້ງງົບ" })).toBeVisible();

  await api(request, s, "POST", "/expenses", [{ category_id: s.cat(FOOD), amount: 60000, txn_date: localDate() }]);
  await page.reload();
  const row = page.getByTestId("budget-list").getByRole("button", { name: new RegExp(FOOD) });
  await expect(row.getByText("ເກີນ 10,000")).toBeVisible();
  await expect(row.getByRole("progressbar")).toHaveAttribute("data-tone", "expense");
});

test("9. copying budgets from last month", async ({ page, request }) => {
  const s = await newUser(request);
  const prev = monthOffset(`${periodMonth(localDate())}-01`, -1).slice(0, 7);
  await api(request, s, "PUT", "/budgets", { category_id: s.cat(FOOD), month: prev, amount: 300000 });
  await api(request, s, "PUT", "/budgets", { category_id: s.cat(TRANSPORT), month: prev, amount: 100000 });
  await loginAs(page, s, "/budgets");

  await page.getByRole("button", { name: "ສຳເນົາຈາກເດືອນກ່ອນ" }).click();
  await expect(page.getByRole("status").filter({ hasText: "2 ໝວດ" })).toBeVisible();
  await expect(page.getByTestId("budget-list").getByRole("button")).toHaveCount(2);
});

test("13. switching months quickly always shows the last selected month", async ({ page, request }) => {
  const s = await newUser(request);
  await api(request, s, "POST", "/expenses", [{ category_id: s.cat(FOOD), amount: 99000, txn_date: localDate() }]);
  // make the current month's summary slow, so it would arrive after the user has moved on
  const periodStart = `${monthOffset(`${periodMonth(localDate())}-01`, -1).slice(0, 7)}-25`;
  await page.route(`**/api/v1/reports/summary?from=${periodStart}*`, async (r) => {
    await new Promise((res) => setTimeout(res, 1500));
    await r.continue();
  });
  await loginAs(page, s, "/");
  const prev = page.getByRole("button", { name: "ເດືອນກ່ອນ" });
  await prev.click();
  await prev.click();
  await prev.click();
  await page.waitForTimeout(2000); // let the slow response for the first month land
  await expect(page.getByTestId("total-expense")).toHaveText("0");
  await expect(page.getByTestId("net")).toHaveText("0");
});

test("14. API down shows an error with retry, and retry recovers", async ({ page, request }) => {
  const s = await newUser(request);
  await loginAs(page, s, "/transactions");
  await expect(page.getByRole("heading", { name: "ລາຍການ" })).toBeVisible();

  await page.route("**/api/v1/transactions**", (r) => r.abort());
  await page.getByRole("button", { name: "ເດືອນກ່ອນ" }).click();
  await expect(page.getByRole("button", { name: "ລອງໃໝ່" })).toBeVisible();

  await page.unroute("**/api/v1/transactions**");
  await page.getByRole("button", { name: "ລອງໃໝ່" }).click();
  await expect(page.getByText("ຍັງບໍ່ມີລາຍການເດືອນນີ້")).toBeVisible();
});
