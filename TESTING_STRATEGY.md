# Testing Strategy: Invoicr

## 1. Executive Summary

Invoicr currently ships one Playwright visual-regression suite (`e2e/snapshots/index.spec.ts`). That catches UI drift, but it does not protect business logic, data persistence, user flows, or accessibility.

This document defines the move to a balanced Testing Trophy:

```
        /
       /  E2E: few, slow, high confidence
      /___
     /    Integration: many, medium speed
    /_____
   /      Unit: many, fast, precise
  /_______
 /  Static analysis: the base
/_________
```

This is the model Matt Pocock teaches and Theo / T3.gg advocates: test behaviour, not implementation; prefer integration tests; keep E2E focused on real user journeys.

## 2. Current State

| What exists | Detail |
|-------------|--------|
| TypeScript | Strict mode (`tsconfig.json`). |
| E2E runner | Playwright via `pnpm run test`. |
| Visual regression | `e2e/snapshots/index.spec.ts`: 4 breakpoints × 2 colour schemes × 4 screenshots = 32 snapshots. |
| Dev server | `playwright.config.ts` boots `pnpm dev` on `localhost:5173`. |
| CI | `.github/workflows/playwright.yml` with snapshot caching and update-on-label support. |

| What is missing |
|-----------------|
| No unit or integration test runner. |
| No tests for utilities (`linePrice`, `formatCurrency`, `ensureFutureCurrency`, `isValidPaymentAmount`, `formJson`, `uuid`). |
| No tests for data layer (`db`, `client.ts`, `address.ts`). |
| No tests for hooks or component trees. |
| No tests for user flows: create invoice, save client, record payment, delete invoice, print preview. |
| No accessibility assertions. |
| No deterministic fixture strategy. |
| No lint step in CI. |

## 3. Principles

1. **Test behaviour, not implementation.** Query by role, label, and visible text. Avoid class-name and DOM-structure assertions. Use `data-testid` only as a last resort.
2. **The closer to the user, the better.** Prefer integration tests over isolated unit tests, except for pure logic with complex edge cases.
3. **E2E is for confidence, not coverage.** Run only the journeys a real user would recognise as a complete task.
4. **Flaky tests are broken tests.** No `waitForTimeout` without documented justification. Tests must be deterministic.
5. **Coverage is a signal, not a target.** Do not chase 100%.

### Anti-patterns

- Snapshot tests for every component.
- Shallow rendering or mocking React internals.
- Testing third-party libraries.
- Asserting on exact class strings.
- E2E tests for every permutation of a form field.

## 4. Tooling

| Layer | Tool |
|-------|------|
| Static | TypeScript strict + ESLint + `eslint-plugin-jsx-a11y` |
| Unit / Integration | **Vitest** + **React Testing Library** + **@testing-library/user-event** |
| E2E / Visual / A11y | **Playwright** + **@axe-core/playwright** |
| CI | GitHub Actions |

### Why Vitest

The project already uses Vite, `vite-tsconfig-paths`, and `react-router` type generation. Vitest reuses the same transform pipeline, `~/*` alias, and route types with minimal configuration.

### Dev dependencies to add

```bash
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @axe-core/playwright eslint @eslint/js typescript-eslint eslint-plugin-jsx-a11y
```

## 5. Directory Layout

```
app/
├── __fixtures__/                 # deterministic data fixtures
│   ├── invoice.ts
│   ├── client.ts
│   └── payment.ts
├── __mocks__/                    # browser API mocks
│   └── browser.ts
├── data/
│   ├── client.ts
│   └── client.test.ts
├── utils/
│   ├── linePrice.tsx
│   └── linePrice.test.ts
├── components/
│   ├── Inputs/
│   │   ├── index.tsx
│   │   └── index.test.tsx
│   └── home/
│       ├── LineItems/
│       │   ├── LineItem.tsx
│       │   └── LineItem.test.tsx
│       └── Totals.test.tsx
├── routes/
│   ├── invoice.tsx
│   └── invoice.test.tsx
└── root.test.tsx

e2e/
├── fixtures/
│   ├── clients.ts
│   └── invoices.ts
├── flows/
│   ├── create-invoice.spec.ts
│   ├── manage-clients.spec.ts
│   ├── record-payment.spec.ts
│   ├── delete-invoice.spec.ts
│   └── navigation.spec.ts
└── snapshots/
    └── index.spec.ts

vitest.config.ts
vitest.setup.ts
```

### Naming conventions

- Unit / integration tests: `*.test.ts` / `*.test.tsx`.
- E2E tests: `*.spec.ts`.
- Co-locate tests next to the code they exercise.

## 6. Test Layers

### 6.1 Static Analysis

- Keep TypeScript strict mode.
- Add ESLint with type-aware rules and `eslint-plugin-jsx-a11y`.
- Run `react-router typegen && tsc` before any test job in CI.
- Fail CI on lint warnings.

### 6.2 Unit Tests

Cover deterministic, side-effect-free modules. No React dependency.

| Module | Key assertions |
|--------|---------------|
| `linePrice` | Totals per `chargeType`; discount is negative; missing type returns `0`; string inputs coerce safely. |
| `formatCurrency` | NaN falls back to `0.00`; two decimal places. |
| `isValidPaymentAmount` | Positive finite numbers pass; `0`, negative, `NaN`, `Infinity` fail. |
| `ensureFutureCurrency` | Strips leading zeros; limits to two decimals; preserves `-`; handles empty input. |
| `uuid` | UUID v4 shape; uses `crypto.getRandomValues`. |
| `formJson` | Serialises text; converts Blobs to base64; returns typed object. |
| `Address` | Fields stored correctly. |
| `client.ts` | `saveClient` / `deleteClient` / `getClients` maintain `clientKeys`; deduplicate; remove. |
| `db.ts` | `save` / `get` / `getAll` / `remove` round-trip; partial key matching works. |

### 6.3 Integration Tests

Render real components with real providers. Assert on visible outcomes. Mock only browser APIs and persistence, not React.

#### Global test environment

```ts
// vitest.setup.ts
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });

  vi.stubGlobal('crypto', {
    getRandomValues: vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = i % 256;
      return arr;
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
```

#### Coverage targets

| Target | Scenarios |
|--------|-----------|
| `TextInput` | typing, `onChange`, auto-resize, prefix/suffix, `formatOnChange`. |
| `SelectInput` / `DateInput` | select option, placeholder, `onChange`. |
| `ImageInput` | file selection updates source. |
| `LineItem` | qty/unitPrice updates total; discount disables qty; last row creates a new row. |
| `Totals` | per-type sub-totals and grand total. |
| `Controls` | Save / Print reachable; client dropdown populated. |
| `ThemeSelector` | toggles light/dark/system and updates `data-theme`. |
| `invoice.tsx` | form renders; invoice ref updates title; save persists invoice. |
| `clients.tsx` | renders cards; creates client; delete modal removes client. |
| `invoices.tsx` | lists invoices; status badge reflects state; payment updates row; delete removes row. |

### 6.4 End-to-End Tests

Run the real Vite dev server. Cover complete user journeys.

| Flow | Outcome |
|------|---------|
| Create and save invoice | Fill form, add line items, click Save, visit `/invoices`, invoice appears. |
| Load client into invoice | Create client, select from dropdown, To address fills. |
| Record payment | Save invoice, click status badge, enter amount, status changes to Paid / Partial. |
| Delete invoice | Save invoice, delete from list, invoice removed. |
| Delete client | Create client, delete via modal, client removed. |
| Navigation and mobile menu | At mobile width, open sidebar, navigate each route. |
| Theme switching | Toggle light/dark/system, UI reflects theme. |
| Print preview | Emulate print media, invoice content visible, UI chrome hidden. |

Seed `localStorage` directly to avoid slow UI setup. The app stores keys as JSON arrays:

```ts
// e2e/fixtures/invoices.ts
import type { Page } from '@playwright/test';

export const invoiceFixture = {
  id: '1735689600',
  date: '2025-01-01',
  purchaseOrder: 'PO-123',
  logo: { url: '' },
  from: { name: 'From Co', streetAddress: '1 From St', city: 'Fromville', county: '', postCode: 'F1 1FF' },
  to: { name: 'To Co', streetAddress: '2 To Rd', city: 'Toville', county: '', postCode: 'T2 2TT' },
  lineItems: [
    { uuid: 'line-1', description: 'Design', name: 'Hourly', qty: '2', unitPrice: '150', type: '0' },
  ],
  payments: [],
};

export async function seedInvoice(page: Page, invoice = invoiceFixture) {
  await page.evaluate((data) => {
    localStorage.setItem(JSON.stringify(['invoice', data.id]), JSON.stringify(data));
  }, invoice);
}
```

`db.getAll(['invoice'])` scans keys containing the substring `invoice`, so `['invoice', id]` is sufficient.

### 6.5 Visual Regression

- Seed localStorage with the same fixture set before every snapshot.
- Replace `waitForTimeout(500)` with `page.waitForLoadState('networkidle')` plus a stable-state assertion.
- Run snapshot tests in a dedicated Playwright project with `workers: 1` on CI to avoid cross-worker `localStorage` contamination.
- Add new snapshots only for new pages or breakpoints.

### 6.6 Accessibility

Run `@axe-core/playwright` scans on `/`, `/clients`, and `/invoices`:

```ts
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('invoice page has no critical a11y violations', async ({ page }) => {
  await page.goto('/');
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
```

Every interactive element must have an accessible-name assertion:

```ts
await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
```

## 7. Configuration

### `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['app/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'e2e'],
  },
});
```

### `package.json` scripts

```json
{
  "scripts": {
    "build": "react-router build",
    "dev": "react-router dev",
    "start": "react-router-serve ./build/server/index.js",
    "typecheck": "react-router typegen && tsc",
    "lint": "eslint .",
    "test": "playwright test",
    "test:unit": "vitest --run app/utils app/data",
    "test:integration": "vitest --run app/components app/routes",
    "test:e2e": "playwright test e2e/flows",
    "test:snapshots": "playwright test e2e/snapshots",
    "test:all": "pnpm run lint && pnpm run typecheck && pnpm run test:unit && pnpm run test:integration && pnpm run test:e2e && pnpm run test:snapshots"
  }
}
```

### Playwright project split

```ts
// playwright.config.ts
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
    testIgnore: ['**/e2e/snapshots/**/*.spec.ts'],
  },
  {
    name: 'visual-regression',
    use: { ...devices['Desktop Chrome'] },
    testMatch: ['**/e2e/snapshots/**/*.spec.ts'],
  },
];
```

## 8. CI/CD

Three jobs. E2E only runs after static checks and unit/integration tests pass.

### Job 1 — Static checks

```yaml
- run: npm install -g pnpm && pnpm install
- run: pnpm run lint
- run: pnpm run typecheck
```

### Job 2 — Unit and integration tests

```yaml
- run: npm install -g pnpm && pnpm install
- run: pnpm run test:unit
- run: pnpm run test:integration
```

### Job 3 — E2E and visual regression

Extend the existing Playwright workflow:

- Add `needs: [static-checks, unit-integration]`.
- Keep snapshot caching and the `[CI] update snapshots` label workflow.
- Upload Playwright report and snapshots on failure.

## 9. Implementation Roadmap

### Phase 1 — Foundation

**Goal:** working unit/integration harness and lint pipeline.

**Deliverables:**
- Install Vitest, React Testing Library, user-event, jest-dom, jsdom, ESLint, a11y plugin.
- Create `vitest.config.ts`, `vitest.setup.ts`, `app/__fixtures__/`, `app/__mocks__/`.
- Add unit tests for every `app/utils` and `app/data` module.
- Add one route integration test (`invoice.test.tsx`) to prove the harness.
- Add `pnpm run lint`, `test:unit`, and `test:integration` scripts.
- Update CI with static and unit/integration jobs.

**Acceptance:** `pnpm run lint`, `pnpm run typecheck`, `pnpm run test:unit`, and `pnpm run test:integration` pass in CI.

### Phase 2 — Route and Component Integration

**Goal:** cover the three routes and key components.

**Deliverables:**
- `app/routes/invoice.test.tsx`: form interactions, line item totals, autosave, save flow.
- `app/routes/clients.test.tsx`: create, edit, delete client.
- `app/routes/invoices.test.tsx`: list, status, payment, delete.
- `app/components/home/LineItems/LineItem.test.tsx`: add, edit, delete, discount.
- `app/components/home/Totals.test.tsx`: totals per type and grand total.
- `app/components/Inputs/index.test.tsx`: text, select, date, image inputs.
- `app/components/ThemeSelector.test.tsx`: theme switching.

**Acceptance:** Every target in section 6.3 has at least one integration test.

### Phase 3 — E2E, A11y, and Deterministic Snapshots

**Goal:** cover real user journeys, accessibility, and stable snapshots.

**Deliverables:**
- Create `e2e/fixtures/` helpers for clients and invoices.
- Update `e2e/snapshots/index.spec.ts` to seed fixtures and remove `waitForTimeout`.
- Add `e2e/flows/` specs for every flow in section 6.4.
- Add `@axe-core/playwright` scans for `/`, `/clients`, `/invoices`.
- Split Playwright projects into flow tests and visual-regression tests.

**Acceptance:** Every core flow has an E2E test; every route has an a11y scan; snapshots are deterministic and pass in CI.

### Phase 4 — Hardening

**Goal:** keep the suite fast and valuable.

- Maintain >90% coverage on `app/utils` + `app/data`.
- Maintain >80% coverage on `app/components` + `app/routes`.
- Remove all unjustified `waitForTimeout` calls.
- Review tests quarterly for flakiness and delete low-value tests.
- Replace `alert()` with a toast to improve testability and UX.

## 10. Decision Log

| Decision | Rationale |
|----------|-----------|
| Vitest over Jest | Reuses existing Vite pipeline and `~/*` alias; no extra transform config. |
| jsdom for component tests | The app is client-rendered (`ssr: false`) and uses browser APIs, not Node APIs. jsdom is sufficient. |
| Co-locate tests | Keeps tests discoverable and makes it likely they are updated with the source file. |
| Seed localStorage directly in E2E | Faster and more deterministic than walking through the UI for setup. |
| Split Playwright projects | Isolates flow tests from snapshot tests so snapshot workers can be constrained to `1`. |
| Coverage is advisory | Prevents gaming the metric; keeps focus on behaviour and user value. |

## 11. Metrics and Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Unit + integration run time | `< 30s` | On the development machine. |
| E2E flow run time | `< 5 minutes` | Excluding snapshot regeneration. |
| Flaky test rate | `0%` | Flaky tests are fixed or deleted within 24 hours. |
| Coverage: `app/utils` + `app/data` | `> 90%` | Pure logic is cheap to cover. |
| Coverage: `app/components` + `app/routes` | `> 80%` | Focus on user-facing branches. |
| Coverage gate | advisory | Informs review; does not block merge. |

## 12. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `localStorage` is global and shared across tests. | Clear it in `beforeEach`; use isolated browser contexts in E2E. |
| Random UUIDs make snapshots and assertions unstable. | Mock `crypto.getRandomValues` in unit/integration; seed data in E2E. |
| React Router client loaders are hard to test in isolation. | Test routes through integration rendering or E2E; do not mock React Router internals. |
| `alert()` blocks Playwright and has no accessible state. | Stub `window.alert` via `page.on('dialog', …)`; replace with a toast. |
| Slow development hardware. | Run unit/integration tests locally; run E2E selectively with `--grep`. |

## 13. Definition of Done

A task is complete only when:

1. `pnpm run lint` passes.
2. `pnpm run typecheck` passes.
3. New pure utilities have unit tests.
4. New components or route behaviours have integration tests.
5. New cross-route or persistence-affecting flows have E2E tests.
6. No new `waitForTimeout` is introduced without documented justification.
7. CI is green.

## 14. Quick Reference

| Command | Purpose |
|---------|---------|
| `pnpm run lint` | ESLint. |
| `pnpm run typecheck` | React Router typegen + TypeScript. |
| `pnpm run test:unit` | Unit tests for utils and data. |
| `pnpm run test:integration` | Component and route integration tests. |
| `pnpm run test:e2e` | Playwright flow tests. |
| `pnpm run test:snapshots` | Playwright visual regression tests. |
| `pnpm run test:all` | Lint, typecheck, unit, integration, E2E, snapshots. |

Start with **Phase 1**. It builds the patterns the rest of the team will follow and delivers the highest confidence per hour invested.
