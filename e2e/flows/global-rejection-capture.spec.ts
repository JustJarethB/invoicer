import { expect, test } from "@playwright/test";

test("a floating rejection with no local catch is captured on the event bus", async ({ page }) => {
  try {
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-theme"), undefined, { timeout: 10_000 });
  } catch {
    await page.waitForTimeout(0);
  }

  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-theme"), undefined, { timeout: 30_000 });

  await page.evaluate(() => {
    void Promise.reject(new Error("e2e float marker"));
  });

  const toast = page.getByTestId("toast-item").filter({ hasText: "e2e float marker" });
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveAttribute("data-severity", "error");
});

test("an uncaught synchronous event-handler error is captured and reaches the browser diagnostics", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-theme"));
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.evaluate(() => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Trigger runtime error";
    button.addEventListener("click", () => {
      throw new Error("e2e synchronous marker");
    });
    document.body.append(button);
  });

  await page.getByRole("button", { name: "Trigger runtime error" }).click();

  const toast = page.getByTestId("toast-item").filter({ hasText: "e2e synchronous marker" });
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveAttribute("data-severity", "error");
  await expect.poll(() => browserErrors).toContain("e2e synchronous marker");
});

test("a reported fire-and-forget operation surfaces exactly one error toast", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      if (key.includes('"clients"')) throw new Error("quota exceeded (e2e)");
      return original.call(this, key, value);
    };
  });

  await page.locator("svg.cursor-pointer").click();
  await expect(page.getByRole("heading", { name: "Save Client" })).toBeVisible();

  await page.evaluate(() => {
    const reasons: string[] = [];
    (window as typeof window & { __floatReasons?: string[] }).__floatReasons = reasons;
    window.addEventListener("unhandledrejection", (event) => {
      reasons.push(event.reason instanceof Error ? event.reason.message : String(event.reason));
    });
  });

  const dialog = page.getByRole("heading", { name: "Save Client" }).locator("..");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();

  const toast = page.getByTestId("toast-item").filter({ hasText: "Client could not be saved" });
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveAttribute("data-severity", "error");

  await page.waitForTimeout(500);
  await expect(page.getByTestId("toast-item").filter({ hasText: "quota exceeded (e2e)" })).toHaveCount(0);

  const reasons = await page.evaluate(() => (window as typeof window & { __floatReasons?: string[] }).__floatReasons ?? []);
  expect(reasons).toEqual(["quota exceeded (e2e)"]);
  await expect(page.getByRole("heading", { name: "Save Client" })).toBeVisible();
  await expect(page.getByTestId("toast-item")).toHaveCount(1);
  await expect(page.locator('[data-testid="toast-item"][data-severity="success"]')).toHaveCount(0);
});

test("normal navigation produces no error toasts", async ({ page }) => {
  try {
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-theme"), undefined, { timeout: 10_000 });
  } catch {
    await page.waitForTimeout(0);
  }

  for (const path of ["/", "/clients", "/invoices"]) {
    await page.goto(path);
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-theme"), undefined, { timeout: 30_000 });
  }

  await expect(page.locator('[data-testid="toast-item"][data-severity="error"]')).toHaveCount(0);
});
