import { expect, test } from "@playwright/test";
import { loginAs, newUser } from "./helpers";

test("1. register lands on an empty overview @desktop", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("tab", { name: "ສະໝັກນຳໃຊ້" }).click();
  await page.getByLabel("ຊື່").fill("ສົມພອນ");
  await page.getByLabel("ອີເມວ").fill(`e2e-reg-${Date.now()}@test.la`);
  await page.locator("#password").fill("secret123");
  await page.getByRole("button", { name: "ສະໝັກນຳໃຊ້" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("ສະບາຍດີ ສົມພອນ")).toBeVisible();
  await expect(page.getByText("ຍັງບໍ່ມີລາຍການເດືອນນີ້")).toBeVisible();
  await expect(page.getByRole("link", { name: "ບັນທຶກລາຍການທຳອິດ" })).toBeVisible();
});

test("2. wrong password shows a Lao error and stays on login", async ({ page, request }) => {
  const s = await newUser(request);
  await page.goto("/login");
  await page.getByLabel("ອີເມວ").fill(s.email);
  await page.locator("#password").fill("wrong-password");
  await page.getByRole("button", { name: "ເຂົ້າສູ່ລະບົບ" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ" })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("12. an invalid or removed token sends the user to login", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mm_token", "not-a-real-token"));
  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem("mm_token"))).toBeNull();
});

test("12b. server down while opening the app keeps the session and offers retry", async ({ page, request }) => {
  const s = await newUser(request);
  await page.route("**/api/v1/me", (r) => r.abort());
  await loginAs(page, s, "/");
  await expect(page.getByRole("button", { name: "ລອງໃໝ່" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("mm_token"))).toBe(s.token);

  await page.unroute("**/api/v1/me");
  await page.getByRole("button", { name: "ລອງໃໝ່" }).click();
  await expect(page.getByRole("heading", { name: "ພາບລວມ" })).toBeVisible();
});
