import { test, expect } from '@playwright/test';

const viewports = {
    sm: { width: 640, height: 800 },
    md: { width: 768, height: 1024 },
    lg: { width: 1024, height: 768 },
    xl: { width: 1280, height: 800 },
} satisfies Record<string, { width: number, height: number }>;

for (const breakpoint of ['sm', 'md', 'lg', 'xl'] as const) {
    for (const colorScheme of ['light', 'dark'] as const) {
        test.describe(`[${colorScheme}][${breakpoint}] Visual Regression Tests`, () => {
            test.beforeEach(async ({ page }) => {
                await page.setViewportSize(viewports[breakpoint]);
                page.emulateMedia({ colorScheme });
                page.clock.setFixedTime(new Date('2001-12-31T12:00:00Z'));
            })
            test(`Invoice page snapshot`, async ({ page, }) => {
                await page.goto('/');
                await page.waitForLoadState('networkidle')
                const screenshot = await page.screenshot({ fullPage: true });
                expect(screenshot).toMatchSnapshot(`homepage-${colorScheme}-${breakpoint}.png`);
            });

            test(`Clients page snapshot`, async ({ page }) => {
                await page.goto('/clients');
                await page.waitForTimeout(500)
                const screenshot = await page.screenshot({ fullPage: true });
                expect(screenshot).toMatchSnapshot(`clients-${colorScheme}-${breakpoint}.png`);
            });

            test('Invoices page snapshot', async ({ page }) => {
                await page.goto('/invoices');
                await page.waitForTimeout(500)
                const screenshot = await page.screenshot({ fullPage: true });
                expect(screenshot).toMatchSnapshot(`invoices-${colorScheme}-${breakpoint}.png`);
            });

            test('Print homepage', async ({ page }) => {
                await page.emulateMedia({ media: 'print' });
                await page.setViewportSize({ width: 794, height: 1123 });
                await page.goto('/');
                await page.waitForLoadState('networkidle')
                const screenshot = await page.screenshot({ fullPage: true });
                expect(screenshot).toMatchSnapshot(`print-homepage-${colorScheme}-${breakpoint}.png`);
            });
        })
    }
}