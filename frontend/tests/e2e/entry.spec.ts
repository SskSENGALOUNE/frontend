import { expect, test } from "@playwright/test";
import { api, FOOD, localDate, loginAs, newUser, num, TRANSPORT } from "./helpers";

test("3. one expense takes 2 taps plus typing the amount @desktop", async ({ page, request }) => {
  const s = await newUser(request);
  await loginAs(page, s, "/entry");

  await page.getByLabel("ຈຳນວນເງິນ").fill("45000"); // typing
  await page.getByRole("radio", { name: FOOD }).click(); // tap 1
  await page.getByRole("button", { name: "ບັນທຶກ", exact: true }).click(); // tap 2

  await expect(page.getByRole("status").filter({ hasText: "ບັນທຶກລາຍຈ່າຍ 45,000 ແລ້ວ" })).toBeVisible();
  await expect(page.getByLabel("ຈຳນວນເງິນ")).toHaveValue("");
  // the chosen category stays selected for the next entry
  await expect(page.getByRole("radio", { name: FOOD })).toHaveAttribute("aria-checked", "true");

  await page.goto("/");
  await expect(page.getByTestId("total-expense")).toHaveText("45,000");
});

test("3b. amount field formats thousands and rejects a 3rd decimal", async ({ page, request }) => {
  const s = await newUser(request);
  await loginAs(page, s, "/entry");
  const amount = page.getByLabel("ຈຳນວນເງິນ");
  await amount.pressSequentially("1234567.891");
  await expect(amount).toHaveValue("1,234,567.89");
});

test("3c. saving without category or amount explains what is missing", async ({ page, request }) => {
  const s = await newUser(request);
  await loginAs(page, s, "/entry");
  await page.getByRole("button", { name: "ບັນທຶກ", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ເລືອກໝວດ ແລະ ໃສ່ຈຳນວນເງິນ" })).toBeVisible();
});

test("4. three expenses go out in one request and empty the basket @desktop", async ({ page, request }) => {
  const s = await newUser(request);
  await loginAs(page, s, "/entry");

  const add = async (cat: string, amount: string) => {
    await page.getByLabel("ຈຳນວນເງິນ").fill(amount);
    await page.getByRole("radio", { name: cat }).click();
    await page.getByRole("button", { name: "ເພີ່ມໃສ່ລາຍການ" }).click();
  };
  await add(FOOD, "45000");
  await add(TRANSPORT, "20000");
  await add(FOOD, "15000");
  await expect(page.getByTestId("basket").locator("li")).toHaveCount(3);
  await expect(page.getByText("ລໍຖ້າບັນທຶກ 3 ລາຍການ")).toBeVisible();

  const requests: string[] = [];
  page.on("request", (r) => r.method() === "POST" && requests.push(new URL(r.url()).pathname));
  await page.getByRole("button", { name: "ບັນທຶກທັງໝົດ (3)" }).click();

  await expect(page.getByRole("status").filter({ hasText: "ບັນທຶກແລ້ວ 3 ລາຍການ ລວມ 80,000" })).toBeVisible();
  await expect(page.getByTestId("basket")).toHaveCount(0);
  expect(requests).toEqual(["/api/v1/expenses"]);

  const list = await api(request, s, "GET", "/transactions?limit=10");
  expect(list.items).toHaveLength(3);
  expect(list.totals.expense).toBe(80000);
  expect(list.items.every((t: { txn_date: string }) => t.txn_date === localDate())).toBe(true);
});

test("5. a basket item whose category was deleted is highlighted and nothing is saved", async ({ page, request }) => {
  const s = await newUser(request);
  const temp = await api(request, s, "POST", "/categories", { name: "ຊົ່ວຄາວ", type: "expense" });
  await loginAs(page, s, "/entry");

  await page.getByLabel("ຈຳນວນເງິນ").fill("10000");
  await page.getByRole("radio", { name: FOOD }).click();
  await page.getByRole("button", { name: "ເພີ່ມໃສ່ລາຍການ" }).click();
  await page.getByLabel("ຈຳນວນເງິນ").fill("5000");
  await page.getByRole("radio", { name: "ຊົ່ວຄາວ" }).click();
  await page.getByRole("button", { name: "ເພີ່ມໃສ່ລາຍການ" }).click();

  await api(request, s, "DELETE", `/categories/${temp.id}`); // deleted elsewhere meanwhile
  await page.getByRole("button", { name: "ບັນທຶກທັງໝົດ (2)" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "ບາງລາຍການມີໝວດທີ່ບໍ່ມີແລ້ວ" })).toBeVisible();
  const items = page.getByTestId("basket").locator("li");
  await expect(items.nth(0)).not.toHaveAttribute("data-invalid", "true");
  await expect(items.nth(1)).toHaveAttribute("data-invalid", "true");
  const list = await api(request, s, "GET", "/transactions");
  expect(list.pagination.total).toBe(0);
});

test("5b. income saves on its own and yesterday chip sets the date", async ({ page, request }) => {
  const s = await newUser(request);
  await loginAs(page, s, "/entry");
  await page.getByRole("radio", { name: "ລາຍຮັບ", exact: true }).click();
  await expect(page.getByRole("button", { name: "ເພີ່ມໃສ່ລາຍການ" })).toHaveCount(0);
  await page.getByLabel("ຈຳນວນເງິນ").fill("5000000");
  await page.getByRole("radio", { name: "ເງິນເດືອນ" }).click();
  await page.getByRole("button", { name: "ມື້ວານ" }).click();
  await page.getByRole("button", { name: "ບັນທຶກ", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "ບັນທຶກລາຍຮັບ 5,000,000 ແລ້ວ" })).toBeVisible();

  const list = await api(request, s, "GET", "/transactions?type=income");
  expect(list.items[0].txn_date).toBe(localDate(-1));
  expect(num(String(list.items[0].amount))).toBe(5000000);
});

test("5c. add a missing category from the entry page and save with it right away @desktop", async ({ page, request }) => {
  const s = await newUser(request);
  await loginAs(page, s, "/entry");
  await page.getByLabel("ຈຳນວນເງິນ").fill("100000");

  await page.getByRole("button", { name: "ເພີ່ມໝວດ" }).click();
  await page.getByLabel("ຊື່ໝວດ").fill("ນ້ຳມັນ");
  await expect(page.getByRole("radio", { name: "fuel" })).toHaveAttribute("aria-checked", "true"); // icon guessed from the name
  await page.getByRole("dialog").getByRole("button", { name: "ເພີ່ມໝວດ" }).click();

  // back on the form: the new category is selected and the amount is kept
  await expect(page.getByRole("radio", { name: "ນ້ຳມັນ" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("ຈຳນວນເງິນ")).toHaveValue("100,000");
  await page.getByRole("button", { name: "ບັນທຶກ", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "ບັນທຶກລາຍຈ່າຍ 100,000 ແລ້ວ" })).toBeVisible();

  const list = await api(request, s, "GET", "/transactions");
  expect(list.items[0]).toMatchObject({ category_name: "ນ້ຳມັນ", category_icon: "fuel", type: "expense", amount: 100000 });
});

test("5d. today's entries show under the form and can be fixed in place @desktop", async ({ page, request }) => {
  const s = await newUser(request);
  await api(request, s, "POST", "/expenses", [{ category_id: s.cat(TRANSPORT), amount: 20000, txn_date: localDate(-1) }]); // yesterday: not listed
  await loginAs(page, s, "/entry");
  const today = page.getByTestId("today-list");
  await expect(today.getByText("ຍັງບໍ່ມີລາຍການມື້ນີ້")).toBeVisible();

  await page.getByLabel("ຈຳນວນເງິນ").fill("45000");
  await page.getByRole("radio", { name: FOOD }).click();
  await page.getByRole("button", { name: "ບັນທຶກ", exact: true }).click();
  await expect(today.getByRole("button", { name: new RegExp(FOOD) })).toContainText("45,000");
  await expect(today).toContainText("1 ລາຍການ");

  // typo: fix the amount from the list without leaving the page
  await today.getByRole("button", { name: new RegExp(FOOD) }).click();
  await page.getByRole("dialog").getByLabel("ຈຳນວນເງິນ").fill("40000");
  await page.getByRole("button", { name: "ບັນທຶກການແກ້ໄຂ" }).click();
  await expect(today.getByRole("button", { name: new RegExp(FOOD) })).toContainText("40,000");
});
