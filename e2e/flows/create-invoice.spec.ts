import { test, expect } from '@playwright/test';
import { seedClient } from '../fixtures/clients';

test('create and save invoice, then view it in the invoice list', async ({ page }) => {
  // Stub out the alert() that the app shows on save; it blocks automation.
  page.on('dialog', (dialog) => {
    expect(dialog.message()).toBe('Invoice Saved');
    void dialog.accept();
  });

  await seedClient(page, {
    id: 'e2e-client',
    contactName: 'E2E Client',
    email: 'e2e@example.com',
    phone: '',
    address: {
      name: 'E2E Client',
      streetAddress: '123 Test Street',
      city: 'Testville',
      county: '',
      postCode: 'TE1 1ST',
    },
  });

  await page.goto('/');

  // Set a deterministic invoice ref so we can find it later.
  await page.getByTestId('invoice-ref').fill('E2E-001');

  // Fill the purchase order so it appears in the invoice list.
  await page.locator('textarea[name="purchaseOrder"]').fill('PO-123');

  // Load the seeded client into the "To" address.
  await page.getByRole('button', { name: /Clients/i }).click();
  await page.getByRole('button', { name: 'E2E Client' }).click();

  // "To" address should populate (the second name input is the "To" panel).
  await expect(page.locator('textarea[name="name"]').nth(1)).toHaveValue('E2E Client');

  // Fill a line item: select the service type, then description, qty and unit price.
  const lineItems = page.getByTestId('line-items');
  await lineItems.getByRole('combobox').first().selectOption('Service');
  await lineItems.locator('textarea[name="description"]').first().fill('Consulting');
  await lineItems.locator('textarea[name="qty"]').first().fill('3');
  await lineItems.locator('textarea[name="unitPrice"]').first().fill('100');

  await page.getByRole('button', { name: /Save/i }).click();

  // Navigate to the invoices list and assert the saved invoice is visible.
  await page.goto('/invoices');
  const row = page.getByRole('row').filter({ hasText: 'E2E-001' });
  await expect(row.getByText('E2E-001')).toBeVisible();
  await expect(row.getByText('PO-123')).toBeVisible();
  await expect(row.getByText('E2E Client')).toBeVisible();
  await expect(row.getByText('£ 300').first()).toBeVisible();
});
