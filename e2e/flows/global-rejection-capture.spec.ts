import { expect, test } from "@playwright/test";

// Production proof for the G2 error-capture paths: jsdom never delivers an
// unhandledrejection to a window listener, and vitest fails the whole run on
// a natural floating rejection (probe-verified), so these paths can only be
// exercised in a real browser. Test 1 is the browser proof that the global
// catcher exists; test 2 pins the converted catch and the exactly-once
// invariant end to end (its single toast is the source publish); test 3 pins
// that normal navigation raises no error toast — the invariant the
// visual-regression suite guards in CI, whose baselines are not tracked
// in-repo. Error toasts never auto-dismiss, so the assertions are stable.

test("a floating rejection with no local catch is captured on the event bus", async ({ page }) => {
  // The first load on a cold dev server can trigger a dependency-optimization
  // reload that destroys the execution context mid-test ("Execution context
  // was destroyed"): the first pass absorbs it, the second runs on warm deps.
  // The warm-up asserts nothing — the second load carries the real
  // assertions, so swallowing a first-load failure cannot produce a false
  // pass.
  try {
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-theme"), undefined, { timeout: 10_000 });
  } catch {
    // Fall through to the warm load below.
  }

  await page.goto("/");
  // ThemeProvider's mount effect sets data-theme on <html> (ThemeSelector.tsx):
  // hydration has run, so the catcher — registered at root.tsx module scope,
  // which evaluates before hydration — is attached before the one-shot
  // rejection fires.
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-theme"), undefined, { timeout: 30_000 });

  // An unhandled rejection in page context fires the real window
  // unhandledrejection event — the exact shape the catcher listens for.
  await page.evaluate(() => {
    void Promise.reject(new Error("e2e float marker"));
  });

  const toast = page.getByTestId("toast-item").filter({ hasText: "e2e float marker" });
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveAttribute("data-severity", "error");
});

test("a converted fire-and-forget catch surfaces exactly one error toast", async ({ page }) => {
  // The SaveClientModal save catch rethrows per the G2 ruling; the Save button
  // discards the promise, so the rejection floats. This drives the exact
  // production shape QA probed (async throw with no local catch) through the
  // real UI. Unlike the test above, it does not prove the catcher attaches —
  // the single toast is the source publish; it pins the conversion and the
  // exactly-once invariant end to end.
  await page.goto("/");

  // Reject only the client-store writes: JSON.stringify(["clients", key])
  // contains '"clients"', while other keys ("clientKeys", invoices) do not.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      if (key.includes('"clients"')) throw new Error("quota exceeded (e2e)");
      return original.call(this, key, value);
    };
  });

  // The "To:" panel is the only ManualSave form on the invoice route; its save
  // icon is the only cursor-pointer icon (Autosave icons use cursor-help).
  await page.locator("svg.cursor-pointer").click();
  await expect(page.getByRole("heading", { name: "Save Client" })).toBeVisible();

  // Record rejections at window level BEFORE the click: the converted catch
  // rethrows and the Save button discards the promise, so the rejection must
  // surface here — the exact interception point of the global catcher.
  await page.evaluate(() => {
    const reasons: string[] = [];
    (window as typeof window & { __floatReasons?: string[] }).__floatReasons = reasons;
    window.addEventListener("unhandledrejection", (event) => {
      reasons.push(event.reason instanceof Error ? event.reason.message : String(event.reason));
    });
  });

  // Scope to the modal card (the h2's parent): the route's own Controls Save
  // button shares the accessible name, so an unscoped role query is ambiguous.
  const dialog = page.getByRole("heading", { name: "Save Client" }).locator("..");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();

  const toast = page.getByTestId("toast-item").filter({ hasText: "Client could not be saved" });
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveAttribute("data-severity", "error");

  // Exactly-once in production: the floating rejection reaches the catcher,
  // which sees the value already published (WeakSet) and adds nothing. The
  // settle wait gives a broken dedupe a window to double-publish before the
  // check; the raw reason text never becomes a toast because the source
  // publish carries the explicit copy. Detailed dedupe pins live in
  // eventLogging.test.ts.
  await page.waitForTimeout(500);
  await expect(page.getByTestId("toast-item").filter({ hasText: "quota exceeded (e2e)" })).toHaveCount(0);

  // The rethrow genuinely floated: exactly one unhandled rejection reached
  // window level, carrying the original error (never a wrapper).
  const reasons = await page.evaluate(() => (window as typeof window & { __floatReasons?: string[] }).__floatReasons ?? []);
  expect(reasons).toEqual(["quota exceeded (e2e)"]);
});

test("normal navigation produces no error toasts", async ({ page }) => {
  // Baseline-free local guard for the regression class the visual-regression
  // suite protects in CI (its baselines are not tracked in-repo; CI restores
  // them from the main-branch snapshot cache): on a clean run the global
  // catcher must stay silent across the app's ordinary routes.
  try {
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-theme"), undefined, { timeout: 10_000 });
  } catch {
    // Fall through to the warm load below.
  }

  for (const path of ["/", "/clients", "/invoices"]) {
    await page.goto(path);
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-theme"), undefined, { timeout: 30_000 });
  }

  // Error toasts never auto-dismiss: any spurious capture during the
  // navigation would still be mounted here.
  await expect(page.locator('[data-testid="toast-item"][data-severity="error"]')).toHaveCount(0);
});
