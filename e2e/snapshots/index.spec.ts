import { test, expect } from '@playwright/test';

const TEST_ID = 'TEST-001'
const TEST_DATE = '2001-12-31'

for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`[${colorScheme}] Visual Regression Tests`, () => {
        test.beforeEach(async ({ page }) => {
            page.emulateMedia({ colorScheme });
        })
        test(`Invoice page snapshot`, async ({ page, }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle')
            const invoiceInput = page.getByTestId('invoice-ref')
            await invoiceInput.fill(TEST_ID);
            const taxDateInput = page.getByTestId('tax-date')
            await taxDateInput.fill(TEST_DATE);
            const lineItemDate = page.getByTestId('line-items').locator('input').first();
            lineItemDate
            await page.evaluate(() => {
                (document.querySelector('[data-testid="line-items"] input[type="date"]') as HTMLInputElement).value = '2001-12-31';
            })
            const screenshot = await page.screenshot({ fullPage: true });
            expect(screenshot).toMatchSnapshot(`homepage-${colorScheme}.png`);
        });

        test(`Clients page snapshot`, async ({ page }) => {
            await page.goto('/clients');
            await page.waitForTimeout(500)
            const screenshot = await page.screenshot({ fullPage: true });
            expect(screenshot).toMatchSnapshot(`clients-${colorScheme}.png`);
        });

        test('Invoices page snapshot', async ({ page }) => {
            await page.goto('/invoices');
            await page.waitForTimeout(500)
            const screenshot = await page.screenshot({ fullPage: true });
            expect(screenshot).toMatchSnapshot(`invoices-${colorScheme}.png`);
        });

        test('Print homepage', async ({ page }) => {
            await page.emulateMedia({ media: 'print' });
            await page.setViewportSize({ width: 794, height: 1123 });
            await page.goto('/');
            await page.waitForLoadState('networkidle')
            const invoiceInput = page.getByTestId('invoice-ref')
            await invoiceInput.fill(TEST_ID);
            const taxDateInput = page.getByTestId('tax-date')
            await taxDateInput.fill(TEST_DATE);
            const screenshot = await page.screenshot({ fullPage: true });
            expect(screenshot).toMatchSnapshot(`print-homepage-${colorScheme}.png`);
        });
    })
}