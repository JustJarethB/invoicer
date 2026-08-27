import { Address } from '~/data/address';
import type { LineItem } from '~/components/home/LineItems/LineItemProvider';
import type { Page } from '@playwright/test';

export type InvoiceFixture = {
  id: string;
  date: string;
  purchaseOrder: string;
  logo: { url: string };
  from: Address;
  to: Address;
  lineItems: LineItem[];
  payments: { amount: number; date: string; method?: string; reference?: string }[];
};

export const invoiceFixture = (overrides?: Partial<InvoiceFixture>): InvoiceFixture => ({
  id: '1735689600',
  date: '2025-01-01',
  purchaseOrder: 'PO-123',
  logo: { url: '' },
  from: new Address('From Co', '1 From St', 'Fromville', '', 'F1 1FF'),
  to: new Address('To Co', '2 To Rd', 'Toville', '', 'T2 2TT'),
  lineItems: [
    {
      uuid: 'line-1',
      description: 'Design',
      name: 'Hourly',
      qty: '2',
      unitPrice: '150',
      type: '0',
      date: '2025-01-01',
    },
  ],
  payments: [],
  ...overrides,
});

export async function seedInvoice(page: Page, invoice = invoiceFixture()) {
  // localStorage requires a real origin; navigate first.
  await page.goto('/');
  await page.evaluate((data) => {
    localStorage.setItem(JSON.stringify(['invoice', data.id]), JSON.stringify(data));
  }, invoice);
}
