# Codebase Review — Invoicer

Date: 2026-08-30
Scope: full app source (~2,500 LOC). Gates verified at time of review: `typecheck` clean, unit + integration tests green (29 passed, 1 skipped), lint at 0 errors / 130 warnings.

## Verdict

Solid foundation, minimal bugs. The main gap versus the Matt Pocock / T3 bar is **domain typing** (money is stored and passed around as strings) and a handful of **shallow modules** that add indirection without hiding complexity. Nothing here is structural doom — the fixes are small and mostly subtract code.

## The good

- Strict TypeScript is on and passing; `any`/`eqeqeq`/unused-var debt was recently paid down (#28, #29, #31).
- `app/db.ts` is a genuinely deep module: small interface (save/get/getAll/remove), localStorage complexity hidden, testable through the interface. Keep this shape.
- `app/components/home/LineItems/LineItemProvider.tsx` is the best-structured state in the app: focused hooks, ID-based rendering, append-on-edit semantics. `Totals.test.tsx` proves tests can drive it through the provider interface.
- Tooling is healthy: Vitest unit/integration split, Playwright e2e/snapshots, ESLint and Prettier separated, CI runs the real gates.

## Issues, in priority order

### 1. Stringly-typed money (biggest one)

`qty`, `unitPrice`, `vatRate` are `string` on the domain model (`LineItemProvider.tsx:6-16`). Every consumer re-parses: `linePrice` does `Number(qty ?? 0)` (`app/utils/linePrice.tsx:5`), `isValidPaymentAmount` guards `prompt()` output, `formatCurrency` defends against NaN at render time (`app/utils/formatCurrency.tsx:1`).

The parse-at-the-boundary rule is inverted: the uncontrolled textarea *is* the boundary, and the raw string leaks all the way into saved invoices (`"qty": "2"` in localStorage forever). This is the root of the NaN-total audit-bug class.

Fix direction: parse once when a line item field is committed, store `qty: number | undefined`, make `linePrice` a pure function over numbers. Tests get simpler as a side effect.

### 2. Domain types scattered and duplicated

- The canonical `Invoice` type doesn't exist in `app/data/` — it's declared locally in `app/routes/invoices.tsx:19`, while `app/routes/invoice.tsx:58` builds the saved shape ad hoc.
- `chargeTypes` lives in a component file (`app/components/home/LineItems/LineItem.tsx:18`) and is imported by a util (`app/utils/linePrice.tsx:1`), so the "pure" money logic depends on a React module.
- `app/routes/invoice.tsx:63` has a live shape bug: `logo: { url: logo }` where `logo` is sometimes already `{ url }` — double-wrapped on save.
- `Payment` is defined in `routes/invoices.tsx:18`; `PaymentDetails` and `Address` are in `app/data/`. Inconsistent home for domain types.

Fix direction: create `app/data/invoice.ts` holding `Invoice`, `Payment`, `chargeTypes`, plus pure derivations (`invoiceTotal`, `paymentStatus`). Routes and components import from there. This gives the codebase its missing center.

### 3. Shallow modules earning less than their interface

- **`Autosave` / `ManualSave`** (`app/components/home/Autosave.tsx`, `ManualSave.tsx`): form wrapper + `formJson` + `db.save`. The interface (`name`, `onChange(record)`) is nearly as complex as the implementation, and it forces the `as unknown as Address` casts at `app/routes/invoice.tsx:130,136,144`. The casts are TypeScript reporting a misplaced seam: `onChange` promises `Record<string, string>` and every caller lies about it. Either type `onChange` per-field, or let each panel own its save and delete the wrappers.
- **`withProvider` HOC** (`app/components/home/withProvider.tsx`): one line of JSX indirection, and the source of the react-refresh warnings already fought. React Router layout routes do this natively.
- **`Address` as a class** (`app/data/address.ts`): 14 lines to do what a type does, and classes don't survive `JSON.parse` (known round-trip audit issue). Should be `type Address = {...}` with an `emptyAddress()` factory next to `NULL_CLIENT`.

### 4. Dead ends and TODO loops

- `ManualSave.onSave` has the actual save commented out (`ManualSave.tsx:31`).
- `useDb` (`app/db.ts:52`) is `useMemo(() => db, [])` around a module constant — delete.
- `ensureFutureCurrency` (`app/utils/ensureFutureCurrency.tsx`) returns `string | undefined`, has documented audit bugs, and the name misleads.
- Commented-out `useLoadClients` fixture block with real personal data (`app/data/client.ts:19-49`) should come out of the tree.
- `randomUUID` (`app/utils/uuid.tsx`) hand-rolls a v4 UUID; `crypto.randomUUID()` is available in every target.

### 5. Presentation and state entangled in `routes/invoices.tsx`

Provider + derived-data hooks + table UI + `prompt()`-based payment in 214 lines. `useInvoiceTotal` / `useInvoicePaymentStatus` are the right instinct but recompute per row via context. Extract `invoiceTotal(invoice)` / `paymentStatus(invoice)` as pure functions in `app/data/invoice.ts` (unit-testable without rendering, like the `linePrice` tests); keep only the table in the route.

### 6. Hand-rolled uncontrolled forms

`formJson` + `defaultValue` everywhere + ref-based extraction (`ManualSave`'s two parallel form refs) works, but validation is re-implemented per call site (`isValidPaymentAmount` exists because `prompt()` returns garbage — and `prompt()` for money should go regardless; `ConfirmDeleteModal` in `app/routes/clients.tsx:112` is already the in-repo pattern). A form library would earn its keep here if form complexity grows. Not urgent.

## Recommended order before new feature work

1. Money strings -> numbers at the boundary (touches `linePrice`, `ensureFutureCurrency`, `LineItem` fields, saved shape). Highest leverage; kills the NaN bug class.
2. `app/data/invoice.ts` — canonical `Invoice`/`Payment` types + pure total/status functions + `chargeTypes`. Cheap, immediately clarifying.
3. Delete `useDb`, `withProvider`, dead `ManualSave` save path, commented client fixtures, hand-rolled `randomUUID`. One tidy PR.
4. Fix the `logo: { url: logo }` double-wrap in `app/routes/invoice.tsx:63`.

## Deliberately left alone

Grid-subgrid table layout, `ThemeProvider`, test count/structure, and the `db` layer abstraction (no second storage backend exists yet — one adapter, hypothetical seam).
