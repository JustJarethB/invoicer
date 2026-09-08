# Coding practices

How to write code that belongs in Invoicr. Every rule here is grounded in
this repository's files and audit history; there is no generic advice.

## 1. Purpose

This document is for LLM coding agents (Claude Code, Codex, Hermes swe
agent) making changes to Invoicr, a ~2,500 LOC freelance-invoicing SPA.
Read it before your first change, and again whenever a review cites it.

What it is not:

- Not a style guide. Prettier and ESLint own formatting; CI runs
  `format:check`. Formatting is never a review topic.
- Not a testing doc. `TESTING_STRATEGY.md` owns the Testing Trophy,
  query-by-role rules and flake policy.
- Not a process doc. `CLAUDE.md` and the rest of `docs/agents/` own
  workflow: issues, triage labels, domain docs.

This doc is about judgement: where code lives, what shapes it takes, and
which mistakes this repository has already made and will not make again.

## 2. Read the repo first

Explore before you write. In order:

1. `app/data/invoice.ts` — the domain centre. Canonical types, pure
   derivations, and the JSDoc style this repo considers good (see
   `chargeTypes` and `LineItem`).
2. `app/db.ts` — the deep-module exemplar: four functions
   (save/get/getAll/remove) hide the entire persistence scheme.
3. `docs/codebase-review.md` and `docs/refactor-round-*.md` — the audit
   history. Every anti-pattern in §6 was a real, merged bug.
4. `CLAUDE.md`, `docs/agents/*` — process. `docs/agents/domain.md`
   says where domain vocabulary lives (`CONTEXT.md`, `docs/adr/`);
   if those are absent, proceed silently.

Do not invent vocabulary. If the domain calls it a `LineItem`, your
code, tests and PR description call it a `LineItem` — never an "entry",
"row" or "invoice line".

## 2.5. The prime directives

Ordered. When two rules conflict, the earlier one wins.

1. **Parse at the boundary, once.** Uncontrolled form strings caused
   the NaN plague (audit 1). `NumberInput` emits `number | undefined`;
   everything downstream stays numeric.
2. **Types are contracts; never cast.** `as unknown as` is forbidden.
   A cast is the type system reporting a misplaced seam — move the
   seam.
3. **One home per concept.** Domain types live in `app/data/`.
   `Invoice` once lived in a route file and `chargeTypes` in a
   component; both produced real bugs.
4. **Money is a number.** Two decimal places, formatted only at render
   by `formatCurrency`, parsed only at input. Never a string, never
   formatted inside domain logic.
5. **Routes are thin.** Fetch, compose, render. Derivation moves to
   `app/data/` as pure functions (`invoiceTotal`, `paymentStatusOf`).
6. **Absence, not empty.** An unset numeric field is a missing property
   (`qty?: number`), never `""` and never a sentinel `0`.
7. **Delete more than you add.** Dead code, lie props and hook costumes
   were all fixed by deletion. The best PRs shrink the tree.
8. **Interfaces must earn their keep.** A wrapper whose interface is as
   complex as its implementation is on the delete list (`Autosave`,
   `withLineItemProvider` are the flagged examples — do not add more).

## 3. Architecture boundaries

Import direction is fixed: `routes → components → data/utils`. Nothing
points upward. `app/data/` and `app/utils/` never import React or a
component — when `chargeTypes` lived in a component file, the pure
money logic ended up importing a React module. That is the canonical
violation.

What belongs where:

- `app/data/` — domain types, pure derivations, and persistence
  through `db.ts`. No React, no formatting.
- `app/utils/` — small generic helpers: `formatCurrency`,
  `parseCurrency`, `formJson`, `randomUUID`, `logger`.
- `app/components/` — React. `components/Inputs/` holds the form
  boundary (`NumberInput` and siblings): the only place strings become
  numbers. `components/home/` holds the invoice-editor parts.
- `app/routes/` — thin route components wired in `app/routes.ts`.
- `app/hooks.ts` — shared hooks (`useMobile`).

Decision table for new code:

| You need to add              | Put it in                        | Because                                             |
| ---------------------------- | -------------------------------- | --------------------------------------------------- |
| A domain type or field       | `app/data/<concept>.ts`          | One home per concept; scattered types were audit 8. |
| A derivation (total, status) | Pure fn in `app/data/invoice.ts` | Unit-testable without rendering; routes thin (9).   |
| FormData → domain shape      | Extractor beside its type        | The seam that replaced every cast (audit 2).        |
| A numeric form field         | `components/Inputs/`             | Boundary is the only string→number place (audit 1). |
| A generic helper             | `app/utils/`                     | Utils never import React or components.             |
| A localStorage read/write    | Owning data module, via `db.ts`  | `db.ts` hides the key scheme; components stay out.  |
| Shared state for a subtree   | Provider + focused hooks         | One hook per operation; no god-hook (audit 5).      |
| A new page                   | `app/routes/` + `app/routes.ts`  | Routes fetch, compose, render — nothing else.       |
| Display formatting           | `formatCurrency` at render       | Never inside domain logic (directive 4).            |

## 3.5. Naming

Use the domain's exact terms:

| Concept         | File                  | Names                                          |
| --------------- | --------------------- | ---------------------------------------------- |
| Invoice         | `app/data/invoice.ts` | `Invoice`, `invoiceTotal`, `paymentStatusOf`   |
| Line item       | `app/data/invoice.ts` | `LineItem`, `linePrice`                        |
| Payment         | `app/data/invoice.ts` | `Payment`, `PaymentStatus`                     |
| Charge type     | `app/data/invoice.ts` | `ChargeType`, `chargeTypes`                    |
| Client          | `app/data/client.ts`  | `Client`, `NULL_CLIENT`, `saveClient`          |
| Address         | `app/data/address.ts` | `Address`, `emptyAddress`, `addressFromRecord` |
| Payment details | `app/data/payment.ts` | `PaymentDetails`, `paymentDetailsFromRecord`   |

Function naming:

- Predicates are prefixed `is`/`has`: `isValidPaymentAmount`.
- Derivations are named for what they return: `invoiceTotal`,
  `linePrice`, `paymentStatusOf` — not `calcTotal` or `getPrice`.
- Extractors are `<Thing>FromRecord`: `addressFromRecord`,
  `paymentDetailsFromRecord`.
- No abbreviations and no synonyms. Not `inv`, not `entry`, not `row`.
- Booleans read as questions at the call site: `isSaving`, `hidden`.

## 4. Readability rules

- Comments explain WHY, not WHAT. The JSDoc on `chargeTypes` and
  `LineItem` in `app/data/invoice.ts` is the standard. A comment that
  restates the code is a smell: rename or restructure until it is
  unneeded, then delete it.
- Keep functions small enough to read top-down. There is no hard line
  count, but `routes/invoices.tsx` at 214 lines was the audit's
  headline example: the fix was extraction of derivations, not
  comments.
- Return early; avoid nested conditionals.
- One concept per line. Do not pack parse + validate + format into a
  single expression.
- Chained ternaries are tolerated exactly where they encode a domain
  decision table — `paymentStatusOf` is the exemplar. Never for control
  flow with side effects; use `if`/`return`.
- `sort/imports` and `sort/exports` are off deliberately: export order
  is reading order. Arrange each file so a newcomer meets the type,
  then the derivations, then the persistence. `sort/import-members`
  and `sort/object-properties` do warn — keep named imports and object
  literals sorted.
- `eqeqeq`, `curly`, `prefer-const` are lint-enforced; do not make
  them prose. If you reach for `==`, the shape is wrong — fix the
  shape.

## 4.5. TypeScript usage

- Strict mode is the floor, not the goal. We do not sprinkle defensive
  checks through the interior; we parse once at the boundary so the
  interior can trust its types. `Number.isNaN` re-checks deep in
  render code are the smell that audit 1 removed.
- Prefer `satisfies` over annotation when you want a literal checked
  without widening it — `chargeTypes satisfies ChargeType[]` is the
  in-repo example.
- Absence over empty: optional numeric fields are `qty?: number`,
  never `number | ""`. For string fields that belong to a shape with an
  empty default, use `?? ""` once, inside the extractor
  (`addressFromRecord`), not at every call site.
- No casts. `as unknown as` is forbidden (audit 2); zero remain in app
  source. A narrow `as` is tolerated only at a system boundary you
  own — `db.ts` at the `JSON.parse` edge — never to silence a mismatch
  between two of our own types. `any` warns; needing it means the
  shape is wrong.
- Type imports use the `type` keyword: `import type { Invoice } from
"~/data/invoice"`. `verbatimModuleSyntax` is on.
- Types must earn their keep: a type that names domain data (`Invoice`,
  `LineItem`) yes; a type that ceremonially restates a function
  signature, no.

## 5. Patterns that work here

Copy these before inventing anything new.

- **Deep modules.** `app/db.ts`: four functions (save/get/getAll/
  remove), `string[]` keys JSON-encoded inside. Callers never see the
  key scheme. New persistence goes through `db.ts`, exposed from the
  owning data module (`saveClient` in `client.ts`) — never called
  from a component.
- **Extractor seam.** One `<Thing>FromRecord` per shape, living with
  its type. `formJsonAddress` in `data/address.ts` reads only the five
  fields `Address` knows about, directly from `FormData`, so it cannot
  pick up unrelated inputs the way a generic form-to-record helper
  can. Reaching for a cast means the seam is missing, not that the
  types are wrong.
- **Boundary components.** `NumberInput` in `components/Inputs/`
  accepts and emits `number | undefined`, parsing via `parseCurrency`
  and normalising on blur. All string→number conversion happens here
  and nowhere else.
- **Pure derivations.** `linePrice`, `invoiceTotal`, `paymentStatusOf`
  are pure functions over numbers, unit-tested without rendering:

  ```ts
  // app/data/invoice.ts — a domain decision table, so a chained
  // ternary reads well here (and only here).
  export const paymentStatusOf = (
    invoice: Pick<Invoice, "lineItems" | "payments">
  ): PaymentSummary => {
    const totalDue = invoiceTotal(invoice);
    const totalPaid = (invoice.payments ?? [])
      .map((p) => p.amount)
      .reduce((p, c) => p + c, 0);
    const paymentStatus: PaymentStatus =
      totalPaid > totalDue
        ? "overpaid"
        : totalPaid > 0 && totalPaid < totalDue
          ? "partial"
          : totalPaid === totalDue
            ? "paid"
            : "unpaid";
    return { totalDue, totalPaid, paymentStatus, due: totalDue - totalPaid };
  };
  ```

- **Context + focused hooks.** `LineItemProvider` with one hook per
  operation (`useLineItems`, `useLineItem`, `useSetLineItem`,
  `useDeleteLineItem`); consumers take the operation they need, not a
  god-hook returning the whole store.
- **Render-prop composition.** `ManualSave` takes an `onSave`
  render prop so the caller owns what "save" means — composition over
  configuration.
- **Keyed lists with stable ids.** `key={line.uuid}` — crypto uuids,
  never the array index, never `Date.now()`.

## 6. Anti-patterns

Each of these was a real, merged bug (see `docs/codebase-review.md`
and the refactor rounds). Do not reintroduce them.

- **Stringly-typed money.** Caused the NaN plague. Money is `number`.
- **`prompt`/`alert`/`confirm`.** `no-alert` warns; validation belongs
  in a typed input (`NumberInput`), not a downstream guard.
- **Defensive re-parsing downstream.** A `Number()` or `parseFloat`
  outside `components/Inputs/` means the boundary leaked; fix the
  boundary.
- **`as unknown as`.** Forbidden. Add an extractor; move the seam.
- **Dead code left in the tree.** Delete it; git remembers.
- **Commented-out code.** The fixture block in `data/client.ts`
  contained real personal data — a privacy lapse, not just clutter.
- **Fake or "lie" props.** A hand-built
  `summary={{ ..., totalPaid: 0 }}` discarding real values means the
  interface is wrong. Change the interface.
- **Shallow wrappers.** `Autosave`'s interface was as complex as its
  implementation. Both it and `withLineItemProvider` are flagged debt
  the audit recommends deleting — do not imitate or extend them.
- **Ad-hoc shapes built in more than one place.** `logo: { url: logo }`
  double-wrapped because two paths constructed the shape. One
  constructor per shape, at the boundary (`logoFromRecord`).
- **TODO without an issue link.** It rots. File the issue or do it
  now. (The tree still carries two `todo:` comments — don't add to
  the pile.)
- **Non-crypto ids.** `new Date().getTime()` collided within a
  millisecond (the client-save key bug, round 2). Use `randomUUID()`.
- **Unkeyed lists.** React cannot reconcile them; key by `uuid`.
- **Blob-URL leaks.** `URL.createObjectURL` without
  `URL.revokeObjectURL` leaks memory. See `ImageInput`'s
  `releasePreviewImage` for the in-repo pattern, including the
  unmount cleanup.
- **`console.log`.** `no-console` warns; use `logger` from
  `~/utils/logger`.
- **Scattered domain types.** One home in `app/data/`, imported
  everywhere.
- **Prop drilling past two levels.** Use the provider pattern
  (`LineItemProvider`).
- **Snapshot tests for everything.** Playwright snapshots are few and
  deliberate; behaviour tests carry the weight. See
  `TESTING_STRATEGY.md`.

## 7. Pass / fail examples

FAIL snippets reproduce real audit findings (the code has since been
deleted or rewritten); PASS snippets show the current pattern. Where a
snippet introduces a name the audit deleted, the name is illustrative —
follow the pattern, not the identifier.

### 7.1. Money is a number — parse at the boundary, once

FAIL — string state leaks into the domain, is re-parsed at render, and
goes NaN when the field is empty:

```tsx
const [qty, setQty] = useState("");

<input value={qty} onChange={(e) => setQty(e.target.value)} />
<span>{formatCurrency(Number(qty ?? 0) * Number(line.unitPrice))}</span>
```

PASS — the boundary emits `number | undefined`; the domain stays
numeric; absence means "not set" (this is the real `LineItem.tsx`
shape):

```tsx
<NumberInput
  name="qty"
  value={item.qty}
  onChange={(qty) => onChange({ qty })}
/>
<span>{formatCurrency(linePrice(item))}</span>
```

```ts
// app/data/invoice.ts — the one place absence becomes zero.
// Blank or untyped lines contribute nothing; Discount ignores qty.
export const linePrice = ({
  qty,
  unitPrice,
  type,
}: Pick<LineItem, "qty" | "unitPrice" | "type">) =>
  chargeTypes
    .find((chargeType) => chargeType.id === type)
    ?.calculation(qty ?? 0, unitPrice ?? 0) ?? 0;
```

### 7.2. Types are contracts — never cast

FAIL — `formJson` returns `Record<string, string>`; every caller lied
to the type system (four call sites did this):

```ts
const record = await formJson<Record<string, string>>(formRef.current);
setTo(record as unknown as Address); // the cast is the seam screaming
```

PASS — one extractor per shape, living with its type; empty strings
are normalised inside the extractor, once (real code from
`app/data/address.ts`):

```ts
export const addressFromRecord = (record: Record<string, string>): Address => ({
  name: record.name ?? "",
  streetAddress: record.streetAddress ?? "",
  city: record.city ?? "",
  county: record.county ?? "",
  postCode: record.postCode ?? "",
});
```

Zero casts remain; adding one means your seam is wrong.

### 7.3. No `prompt()` for money

FAIL — untyped input defended by a downstream guard (the pre-audit
`routes/invoices.tsx`):

```ts
const raw = window.prompt("Payment amount");
const amount = parseFloat(raw ?? "");
if (!isValidPaymentAmount(amount)) return;
makePayment(invoiceId, amount);
```

PASS — a modal with a typed input; validation runs on the number the
input already produced (the real `PaymentModal`):

```tsx
const [amount, setAmount] = useState<number | undefined>(undefined);
const [error, setError] = useState<string | null>(null);

<NumberInput
  autoFocus
  name="amount"
  prefix="£"
  placeholder="0.00"
  value={amount}
  onChange={setAmount}
/>;
// submit: amount === undefined || !isValidPaymentAmount(amount)
//   → setError("Enter a non-zero amount")
```

The guard remains as a final check at the state boundary — but the
input makes garbage rare instead of expected.

### 7.4. Ids are crypto uuids

FAIL — two saves in the same millisecond collide (round-2 bug: the
client key and the `saveClient` key could differ):

```ts
const id = `${new Date().getTime()}`.substring(0, 10);
```

PASS (real code — `LineItemProvider.tsx` and `utils/uuid.ts`):

```ts
import { randomUUID } from "~/utils/uuid";

const newLineItem = (): LineItem => ({ uuid: randomUUID() });
```

Note the absent optional fields — no `qty: 0` or `type: "1"` filler.

### 7.5. One home per concept; routes are thin

FAIL — the canonical `Invoice` type lived in a route, next to inline
derivation (`routes/invoices.tsx` was 214 lines):

```tsx
// routes/invoices.tsx — the old shape
export type Invoice = { id: string; lineItems: LineItem[] };
const useInvoiceTotal = () =>
  useInvoices().map((inv) =>
    inv.lineItems.reduce((sum, l) => sum + linePrice(l), 0)
  );
```

PASS — the type lives in `app/data/invoice.ts`; derivation is a pure,
unit-tested function; the route fetches, composes, renders (real
code):

```tsx
// routes/invoices.tsx — now
import { paymentStatusOf, type Invoice } from "~/data/invoice";

const summary = paymentStatusOf(invoice);
const { totalDue, due, paymentStatus } = summary;
<td>£ {formatCurrency(totalDue)}</td>;
```

### 7.6. Format money only at render

FAIL — domain logic returning a display string:

```ts
export const invoiceTotal = (invoice: Invoice): string =>
  formatCurrency(invoice.lineItems.map(linePrice).reduce((p, c) => p + c, 0));
```

PASS — numbers in, numbers out; the only place a total becomes a
string is the render boundary (real code):

```ts
export const invoiceTotal = (invoice: Pick<Invoice, "lineItems">): number =>
  invoice.lineItems.map(linePrice).reduce((p, c) => p + c, 0);
```

Saved invoices hold numbers; `formatCurrency` appears only in tsx.

### 7.7. Delete dead code, lie props and hook costumes

FAIL — all three found in one audit round:

```tsx
// const fixture = { name: "Jane Realname", email: "jane@real.example" };
function useDb() {
  return useMemo(() => db, []); // a module constant in a hook costume
}
<PaidStatus summary={{ ...realSummary, totalPaid: 0 }} />; // the lie
```

PASS — delete the fixture (git remembers), delete `useDb` (call the
data module directly), and feed components the real domain object:

```tsx
const summary = paymentStatusOf(invoice);
<PaidStatus id={id} summary={summary} />;
```

If a prop must be hand-constructed to fit, the interface is wrong —
change the interface, don't lie to it.

### 7.8. Layout routes over new HOCs

FAIL — wrapping a route by hand when `app/routes.ts` already composes
(how `withLineItemProvider` works today — flagged debt, do not copy):

```tsx
export default withLineItemProvider(function Home() {
  /* ... */
});
```

PASS — the established in-repo composition: `routes.ts` wraps a layout
around child routes, and the layout renders `<Outlet />`
(`app/layouts/navbar.tsx`):

```tsx
// app/routes.ts
layout("layouts/navbar.tsx", [
  index("routes/invoice.tsx"),
  route("clients", "routes/clients.tsx"),
]);
```

### 7.9. Keyed lists and revoked blob URLs

FAIL — no key, and an object URL that is never revoked (both were
real audit findings):

```tsx
{
  invoices.map((invoice) => (
    <tr>
      <td>{invoice.id}</td>
      <td>
        <img src={URL.createObjectURL(file)} alt="logo" />
      </td>
    </tr>
  ));
}
```

PASS — stable keys, and the URL's lifetime owned by the component
(the real `ImageInput` pattern):

```tsx
const releasePreviewImage = () => {
  if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  objectUrlRef.current = null;
};
useEffect(() => releasePreviewImage, []); // revoke on unmount

{
  invoices.map((invoice) => <InvoiceRow key={invoice.id} id={invoice.id} />);
}
```

### 7.10. `logger`, not `console`

FAIL:

```ts
console.log("saved invoice", invoice);
```

PASS (real code — `app/utils/logger.ts`, used across the app):

```ts
import { logger } from "~/utils/logger";

logger.debug("Loaded clients:", clients);
```

`no-console` and `no-alert` are warnings, and warnings are review
topics: they exist to push you towards `logger` and typed inputs.

## 8. Definition of done

Run every local gate before pushing; CI re-runs them on the PR.

| Gate            | Command                     | Scope                            |
| --------------- | --------------------------- | -------------------------------- |
| Types           | `pnpm run typecheck`        | Strict; zero errors.             |
| Lint            | `pnpm run lint`             | Warnings are review topics.      |
| Format          | `pnpm run format:check`     | Never hand-format; run Prettier. |
| Unit            | `pnpm run test:unit`        | `app/utils`, `app/data`.         |
| Integration     | `pnpm run test:integration` | Components and routes via RTL.   |
| e2e + snapshots | CI only                     | Playwright needs a browser.      |

Checklist before opening the PR:

- [ ] All five local gates pass.
- [ ] Self-reviewed the diff as a stranger would; deleted anything you
      cannot justify in one sentence.
- [ ] No new casts, no `console`/`alert`, no TODO without an issue
      link.
- [ ] New domain concepts have exactly one home in `app/data/`;
      routes are still thin.
- [ ] Money never became a string; ids are uuids; lists are keyed;
      blob URLs are revoked.
- [ ] Tests query by role/label/text; no `waitForTimeout`;
      behaviour, not implementation.
- [ ] Conventional commit (`feat`/`fix`/`chore`/`ci`/`docs`/
      `refactor`/`style`/`test`); the PR description explains WHY —
      the diff already shows what.

If this document and the code ever disagree, the code is right — fix
the document in the same PR.
