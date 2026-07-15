import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/zh-CN/register");
  await page.getByLabel("显示名称").fill("端到端测试用户");
  await page.getByLabel("邮箱").fill(`e2e-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("密码").fill("Production123!");
  await page.getByRole("button", { name: "创建账户", exact: true }).click();
  await expect(page).toHaveURL(/\/zh-CN\/onboarding$/);
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.getByRole("button", { name: "完成设置", exact: true }).click();
  await expect(page).toHaveURL(/\/zh-CN\/app\/home$/);
  await expect(page.getByRole("heading", { name: "早上好，端到端测试用户" })).toBeVisible();
});

test("adds independent CNY and AUD items without cross-currency totals", async ({ page }) => {
  const addItem = async (name: string, amount: string, currency: string) => {
    await page.getByRole("main").getByRole("button", { name: "添加物品", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "添加物品" });
    await dialog.getByLabel("物品名称").fill(name);
    await dialog.getByLabel("金额").fill(amount);
    await dialog.getByRole("combobox", { name: "货币" }).click();
    await page.getByRole("option", { name: currency }).click();
    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page).toHaveURL(/\/items\//);
    await page.goto("/zh-CN/app/home");
  };
  await addItem("iPhone", "6999", "CNY");
  await addItem("MacBook Pro", "3499", "AUD");
  const summary = page.getByRole("region", { name: "累计购入" });
  await expect(summary.getByText("¥6,999.00", { exact: true })).toBeVisible();
  await expect(summary.getByText("AU$3,499.00", { exact: true })).toBeVisible();
  await expect(page.getByText("¥10,498.00", { exact: true })).toHaveCount(0);
});

test("core page has no serious axe violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("receipt scan falls back safely when OCR is not configured", async ({ page }) => {
  await page.locator('input[type="file"][accept*="image"]').setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71]),
  });
  await expect(page.getByRole("dialog", { name: "添加物品" })).toBeVisible();
  await expect(page.getByText("OCR 服务尚未配置，已切换为手动录入。")).toBeVisible();
});
