import { expect, test } from "@playwright/test";
import { api, FOOD, localDate, loginAs, monthOffset, newUser, TRANSPORT } from "./helpers";

test("7. edit then delete a transaction", async ({ page, request }) => {
  const s = await newUser(request);
  await api(request, s, "POST", "/expenses", [{ category_id: s.cat(FOOD), amount: 30000, txn_date: localDate(), note: "ເຂົ້າປຽກ" }]);
  await loginAs(page, s, "/transactions");

  await page.getByRole("button", { name: /ເຂົ້າປຽກ/ }).click();
  const amount = page.getByLabel("ຈຳນວນເງິນ");
  await amount.fill("35000");
  await page.getByRole("radio", { name: TRANSPORT }).click();
  await page.getByRole("button", { name: "ບັນທຶກການແກ້ໄຂ" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ແກ້ໄຂແລ້ວ" })).toBeVisible();
  const row = page.getByRole("button", { name: /ເຂົ້າປຽກ/ });
  await expect(row).toContainText(TRANSPORT);
  await expect(row).toContainText("35,000");

  await row.click();
  await page.getByRole("button", { name: "ລຶບລາຍການ" }).click();
  await page.getByRole("button", { name: "ລຶບ", exact: true }).click();
  await expect(page.getByText("ຍັງບໍ່ມີລາຍການເດືອນນີ້")).toBeVisible();
});

test("7b. search is debounced and filters by note", async ({ page, request }) => {
  const s = await newUser(request);
  await api(request, s, "POST", "/expenses", [
    { category_id: s.cat(FOOD), amount: 1000, txn_date: localDate(), note: "ກາເຟ" },
    { category_id: s.cat(FOOD), amount: 2000, txn_date: localDate(), note: "ເຂົ້າ" },
  ]);
  await loginAs(page, s, "/transactions");
  await expect(page.getByTestId("txn-list").getByRole("button")).toHaveCount(2);

  const searches: string[] = [];
  page.on("request", (r) => r.url().includes("q=") && searches.push(r.url()));
  await page.getByLabel("ຄົ້ນຫາໝາຍເຫດ").pressSequentially("ກາເຟ", { delay: 40 });
  await expect(page.getByTestId("txn-list").getByRole("button")).toHaveCount(1);
  expect(searches.length).toBe(1);
});

test("10. a recurring item started 2 months ago back-fills 3 transactions", async ({ page, request }) => {
  const s = await newUser(request);
  await loginAs(page, s, "/recurring");
  await page.getByRole("button", { name: "ເພີ່ມ", exact: true }).click();
  await page.getByLabel("ຈຳນວນເງິນ").fill("1500000");
  await page.getByRole("radio", { name: "ຄ່ານ້ຳ ຄ່າໄຟ ຄ່າໂທ" }).click();
  await page.getByLabel("ເລີ່ມວັນທີ").fill(monthOffset(localDate(), -2));
  await page.getByRole("button", { name: "ຕັ້ງລາຍການປະຈຳ" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ບັນທຶກຍ້ອນຫຼັງໃຫ້ 3 ຄັ້ງ" })).toBeVisible();

  const list = await api(request, s, "GET", "/transactions?from=2000-01-01&to=2100-01-01");
  const dates = list.items.map((t: { txn_date: string }) => t.txn_date).sort();
  expect(dates).toEqual([monthOffset(localDate(), -2), monthOffset(localDate(), -1), localDate()]);
});

test("10b. pausing then resuming does not back-fill the paused period", async ({ page, request }) => {
  const s = await newUser(request);
  const r = await api(request, s, "POST", "/recurring", { type: "expense", category_id: s.cat(FOOD), amount: 100, frequency: "daily", start_date: localDate() });
  expect(r.generated_count).toBe(1);
  await loginAs(page, s, "/recurring");
  await page.getByRole("button", { name: new RegExp(FOOD) }).click();
  await page.getByRole("button", { name: "ຢຸດ" }).click();
  await expect(page.getByText("ຢຸດໄວ້")).toBeVisible();
  await page.getByRole("button", { name: new RegExp(FOOD) }).click();
  await page.getByRole("button", { name: "ເປີດໃຊ້ຄືນ" }).click();
  await expect(page.getByText(/ຄັ້ງຕໍ່ໄປ/)).toBeVisible();
  const after = await api(request, s, "GET", `/recurring/${r.id}`);
  expect(after.generated_count).toBe(1);
});

test("11. deleting a category that is in use explains why it failed", async ({ page, request }) => {
  const s = await newUser(request);
  await api(request, s, "POST", "/expenses", [{ category_id: s.cat(FOOD), amount: 1000, txn_date: localDate() }]);
  await loginAs(page, s, "/categories");
  await page.getByRole("button", { name: FOOD }).click();
  await page.getByRole("button", { name: "ລຶບໝວດ" }).click();
  await expect(page.getByText("ງົບປະມານຂອງໝວດນີ້ທຸກເດືອນຈະຖືກລຶບນຳ")).toBeVisible();
  await page.getByRole("button", { name: "ລຶບ", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ບໍ່ໄດ້ ເພາະຍັງມີລາຍການ" })).toBeVisible();
});

test("11b. new category with custom icon and color shows up in the entry grid", async ({ page, request }) => {
  const s = await newUser(request);
  await loginAs(page, s, "/categories");
  await page.getByRole("button", { name: "ເພີ່ມໝວດ" }).click();
  await page.getByLabel("ຊື່ໝວດ").fill("ກາເຟ");
  await page.getByRole("radio", { name: "coffee" }).click();
  await page.getByRole("radio", { name: "amber" }).click();
  await page.getByRole("button", { name: "ເພີ່ມໝວດ" }).last().click();
  await expect(page.getByRole("status").filter({ hasText: "ເພີ່ມໝວດ ກາເຟ ແລ້ວ" })).toBeVisible();
  const cats = await api(request, s, "GET", "/categories?type=expense");
  expect(cats.find((c: { name: string }) => c.name === "ກາເຟ")).toMatchObject({ icon: "coffee", color: "amber" });

  await page.goto("/entry");
  await expect(page.getByRole("radio", { name: "ກາເຟ" })).toBeVisible();
});

test("profile: change name and password", async ({ page, request }) => {
  const s = await newUser(request);
  await loginAs(page, s, "/profile");
  await page.getByLabel("ຊື່").fill("ນາງ ແກ້ວ");
  await page.getByRole("button", { name: "ບັນທຶກ", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "ບັນທຶກໂປຣໄຟລ໌ແລ້ວ" })).toBeVisible();

  await page.locator("#pw-current").fill("wrong");
  await page.locator("#pw-new").fill("newpass1");
  await page.getByRole("button", { name: "ປ່ຽນລະຫັດຜ່ານ" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ລະຫັດຜ່ານປັດຈຸບັນບໍ່ຖືກຕ້ອງ" })).toBeVisible();
  await page.locator("#pw-current").fill("secret123");
  await page.getByRole("button", { name: "ປ່ຽນລະຫັດຜ່ານ" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ປ່ຽນລະຫັດຜ່ານແລ້ວ" })).toBeVisible();
});
