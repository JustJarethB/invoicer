# Coding practices

Rules for LLM agents changing Invoicr. Grounded in this repo's files and
audit history. Read before your first change.

Not a style guide (Prettier/ESLint own formatting), not a testing doc
(`TESTING_STRATEGY.md`), not process (`CLAUDE.md`, `docs/agents/`).
This doc is judgement: where code lives, what shape it takes, and which
mistakes this repository has already made and will not make again.

## 1. Read the repo first

In order: `app/data/invoice.ts` (domain centre — canonical types, pure
derivations, the JSDoc standard), `app/db.ts` (deep-module exemplar),
`docs/codebase-review.md` + `docs/refactor-round-*.md` (the audit
history — every §7 anti-pattern was a real, merged bug), `CLAUDE.md`
and `docs/agents/*` (process).

Do not invent vocabulary. The domain calls it a `LineItem`; so do your
code, tests and PR description — never "entry", "row", "invoice line".

## 2. Prime directives

Ordered; when rules conflict, the earlier wins.

1. **Parse at the boundary, once.** `NumberInput` emits
   `number | undefined`; downstream stays numeric. Uncontrolled form
   strings caused the NaN plague (audit 1).
2. **Types are contracts; never cast.** `as unknown as` is forbidden —
   a cast reports a misplaced seam; move the seam.
3. **One home per concept.** Domain types live in `app/data/`.
4. **Money is a number.** Formatted only at render (`formatCurrency`),
   parsed only at input. Never a string.
5. **Routes are thin.** Fetch, compose, render; derivation is pure
   functions in `app/data/`.
6. **Absence, not empty.** An unset field is a missing property
   (`qty?: number`), never `""`, never a sentinel `0`.
7. **Delete more than you add.** Dead code, lie props and shallow
   wrappers were all fixed by deletion.
8. **Interfaces must earn their keep.** A wrapper whose interface is as
   complex as its implementation gets deleted (`Autosave`,
   `withLineItemProvider` are the flagged examples).

## 3. Architecture boundaries

Import direction is fixed: `routes → components → data/utils`. Nothing
points upward; `data/` and `utils/` never import React or components.

- `app/data/` — domain types, pure derivations, persistence via
  `db.ts`. No React, no formatting.
- `app/utils/` — generic helpers: `formatCurrency`, `parseCurrency`,
  `formJson`, `randomUUID`, `logger`.
- `app/components/` — React; `components/Inputs/` is the form boundary,
  the only place strings become numbers.
- `app/routes/` — thin routes wired in `app/routes.ts`.

Decision table for new code:

| You need to add              | Put it in                        | Because                         |
| ---------------------------- | -------------------------------- | ------------------------------- |
| A domain type or field       | `app/data/<concept>.ts`          | One home per concept            |
| A derivation (total, status) | Pure fn in `app/data/invoice.ts` | Unit-testable without rendering |
| FormData → domain shape      | Extractor beside its type        | The seam that replaced casts    |
| A numeric form field         | `components/Inputs/`             | The only string→number boundary |
| A generic helper             | `app/utils/`                     | No React imports                |
| localStorage read/write      | Owning data module, via `db.ts`  | Key scheme stays hidden         |
| Shared state for a subtree   | Provider + focused hooks         | One hook per operation          |
| A new page                   | `app/routes/` + `app/routes.ts`  | Fetch, compose, render only     |
| Display formatting           | `formatCurrency` at render       | Never inside domain logic       |

## 4. Naming

Domain vocabulary (exact terms, no synonyms):

| Concept         | File                  | Names                                          |
| --------------- | --------------------- | ---------------------------------------------- |
| Invoice         | `app/data/invoice.ts` | `Invoice`, `invoiceTotal`, `paymentStatusOf`   |
| Line item       | `app/data/invoice.ts` | `LineItem`, `linePrice`                        |
| Payment         | `app/data/invoice.ts` | `Payment`, `PaymentStatus`                     |
| Charge type     | `app/data/invoice.ts` | `ChargeType`, `chargeTypes`                    |
| Client          | `app/data/client.ts`  | `Client`, `NULL_CLIENT`, `saveClient`          |
| Address         | `app/data/address.ts` | `Address`, `emptyAddress`, `addressFromRecord` |
| Payment details | `app/data/payment.ts` | `PaymentDetails`, `paymentDetailsFromRecord`   |

Predicates prefix `is`/`has` (`isValidPaymentAmount`); derivations are
named for what they return (`invoiceTotal`, not `calcTotal`);
extractors are `<Thing>FromRecord`. No abbreviations.

## 5. Readability and TypeScript

- Comments explain WHY, not WHAT — the JSDoc on `chargeTypes` is the
  standard. A comment restating code is a smell: rename, then delete.
- Return early; guard clauses over nesting.
- One concept per line; no parse+validate+format one-liners.
- Chained ternaries only for domain decision tables
  (`paymentStatusOf`); never for side-effecting control flow.
- Strict mode is the floor: parse once at the boundary so the interior
  can trust its types. No defensive re-checks deep in render code.
- `satisfies` over annotation for literal config — checks without
  widening (`chargeTypes satisfies ChargeType[]`).
- Optional numeric fields are `qty?: number`; empty-string defaults are
  normalised once inside extractors (`record.name ?? ""`).
- A narrow `as` only at a boundary you own (`db.ts` at `JSON.parse`),
  never between two of our own types. `any` warns; needing it means the
  shape is wrong.
- Type imports use the `type` keyword (`verbatimModuleSyntax` is on).
- Lint owns `eqeqeq`, `curly`, `prefer-const`; `sort/imports` and
  `sort/exports` are off deliberately — export order is reading order.

## 6. Patterns that work here

- **Deep modules.** `app/db.ts`: four functions hide the entire
  persistence scheme. New persistence goes through `db.ts`, exposed
  from the owning data module — never called from a component.
- **Extractor seam.** One `<Thing>FromRecord` per shape, living with
  its type (`addressFromRecord`). A cast means the seam is missing.
- **Boundary components.** `NumberInput` accepts/emits
  `number | undefined`; all string→number conversion lives in
  `components/Inputs/`.
- **Pure derivations.** `linePrice`, `invoiceTotal`, `paymentStatusOf`
  are pure functions over numbers, unit-tested without rendering —
  see `app/data/invoice.ts`.
- **Context + focused hooks.** `LineItemProvider` exposes one hook per
  operation (`useLineItems`, `useSetLineItem`, …), not a god-hook.
- **Render-prop composition.** `ManualSave` takes `onSave`; the caller
  owns what "save" means.
- **Keyed lists.** `key={line.uuid}` — stable crypto uuids, never the
  index.

## 7. Anti-patterns

Each was a real, merged bug (see `docs/codebase-review.md`). Do not
reintroduce:

- **Stringly-typed money** — the NaN plague. Money is `number`.
- **`prompt`/`alert`/`confirm`** — validation belongs in a typed input.
- **Defensive re-parsing downstream** — `Number()` outside
  `components/Inputs/` means the boundary leaked.
- **`as unknown as`** — add an extractor; move the seam.
- **Dead or commented-out code** — the deleted fixture block contained
  real personal data. Delete; git remembers.
- **Lie props** — a hand-built `summary={{ ..., totalPaid: 0 }}` means
  the interface is wrong; change the interface.
- **Shallow wrappers** — `Autosave`/`withLineItemProvider` are flagged
  debt; do not imitate or extend.
- **Shapes built in more than one place** — `logo: { url: logo }`
  double-wrapped. One constructor per shape, at the boundary.
- **TODO without an issue link** — file it or do it now.
- **`new Date().getTime()` ids** — collide within a millisecond; use
  `randomUUID()`.
- **Unkeyed lists** — React cannot reconcile them.
- **Blob-URL leaks** — see `ImageInput`'s `releasePreviewImage`.
- **`console.log`** — use `logger`.
- **Prop drilling past two levels** — use the provider pattern.
- **Snapshot tests for everything** — behaviour tests carry the weight.

## 8. Design patterns

General TS/React community practice, chosen because the codebase
already follows it everywhere — write new code in these shapes.

### 8.1. Prefer a lookup table over switch and if chains

Map variants to values with a `const` table — exhaustive at compile
time; adding a case is adding a row, not a branch.

```tsx
// ❌ a branch per variant — exhaustive only by discipline
const badgeClasses = (variant: Variant): string => {
  switch (variant) {
    case "success":
      return "bg-green-100 text-green-800";
    case "warning":
      return "bg-amber-100 text-amber-800";
    case "danger":
      return "bg-red-100 text-red-800";
  }
};

// ✅ a row per variant — a missing row is a compile error
const badgeClasses: Record<Variant, string> = {
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
};
```

In this repo: `Button.tsx` maps color/size via `switch` — the live
candidate.

### 8.2. Prefer type aliases over interface

`type` cannot silently declaration-merge, and it expresses unions and
mapped types `interface` cannot.

```ts
// ❌ declaration merging: compiles, silently changes User everywhere
interface User {
  id: string;
  name: string;
}
interface User {
  email: string;
}

// ✅ a duplicate `type User` is a compile error
type User = {
  id: string;
  name: string;
  email: string;
};
type Admin = User & { permissions: string[] };
```

### 8.3. Prefer string-literal unions over enums

Unions are zero-cost at runtime and inferred from plain literals;
callers never import an enum to pass a string.

```ts
// ❌ every caller must import the enum
enum Status {
  Draft = "draft",
  Sent = "sent",
}
setStatus(Status.Draft);

// ✅ the literal is the value
type Status = "draft" | "sent";
setStatus("draft");
```

### 8.4. Write components as arrow functions

Arrow functions with destructured, alias-typed props. Never class
components, `function` declarations, or `React.FC`.

```tsx
// ❌ class component (or `function`, or `React.FC`)
class Badge extends Component<{ label: string; count: number }> {
  render() {
    return (
      <span>
        {this.props.label}: {this.props.count}
      </span>
    );
  }
}

// ✅ arrow + alias-typed destructured props
type BadgeProps = {
  label: string;
  count: number;
};
const Badge = ({ label, count }: BadgeProps) => (
  <span>
    {label}: {count}
  </span>
);
```

### 8.5. Derive values in render; never mirror them in state

If it can be computed during render, compute it — mirroring in
`useState` forks the source of truth and syncs via effects.

```tsx
// ❌ two sources of truth, synced by effect
const PriceTag = ({ price }: { price: number }) => {
  const [formatted, setFormatted] = useState("");
  useEffect(() => setFormatted(`$${price.toFixed(2)}`), [price]);
  return <span>{formatted}</span>;
};

// ✅ always in sync, no effect
const PriceTag = ({ price }: { price: number }) => (
  <span>${price.toFixed(2)}</span>
);
```

### 8.6. Freeze static structures with as const

```ts
// ❌ string[], mutable, no literal types
const columns = ["name", "qty", "price"];
type Column = (typeof columns)[number]; // just string

// ✅ readonly tuple; Column = "name" | "qty" | "price"
const columns = ["name", "qty", "price"] as const;
type Column = (typeof columns)[number];
columns.push("total"); // Error: readonly
```

### 8.7. Derive prop types with Pick and Omit

Projected fields follow their source; hand-copied fields drift.

```ts
type InputProps = { value: string; maxLength?: number; placeholder?: string };

// ❌ copied by hand, already drifting
type SearchFieldProps = {
  value: string;
  maxLength?: number;
  onSearch: (query: string) => void;
};

// ✅ follows InputProps automatically
type SearchFieldProps = Pick<InputProps, "value" | "maxLength"> & {
  onSearch: (query: string) => void;
};
```

In this repo: `Pick<ComponentPropsWithoutRef<typeof TextInput>, ...>`
in `Inputs/index.tsx`.

### 8.8. Provide deep data through context with focused hooks

Data travelling through 3+ courier components belongs in context, with
one hook per operation.

```tsx
// ❌ couriers that only forward
const App = ({ user }: { user: User }) => <Layout user={user} />;
const Layout = ({ user }: { user: User }) => <Header user={user} />;
const Header = ({ user }: { user: User }) => <Avatar name={user.name} />;

// ✅ one focused hook per operation; components take what they need
const SessionContext = createContext<Session | null>(null);
const useSession = (): Session => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be inside SessionProvider");
  return ctx;
};
const useCurrentUser = () => useSession().user;
const useLogout = () => useSession().logout;
```

In this repo: `LineItemProvider` exposes `useLineItems`, `useLineItem`,
`useSetLineItem`, `useDeleteLineItem`.

### 8.9. Use functional state updates, not stale closures

When the next state depends on the previous, pass an updater — a
closure captures a stale copy.

```tsx
// ❌ reads this render's copy — double invoke adds step once
const increment = () => setCount(count + step);
const double = () => {
  increment();
  increment(); // both read the same old count
};

// ✅ updaters queue; each sees the latest state
const increment = () => setCount((c) => c + step);
const double = () => {
  increment();
  increment(); // applied to the latest value
};
```

In this repo: `setOpen((o) => !o)`, `setInvoices((prev) => prev.map(...))`.

## 9. Definition of done

All gates green before push; CI re-runs them and adds Playwright:
`pnpm run typecheck`, `lint`, `format:check`, `test:unit`,
`test:integration`.

Before opening the PR: self-review the diff as a stranger would and
delete what you cannot justify in one sentence; introduce no §7
anti-pattern; conventional commit; the PR description explains WHY.

If this document and the code ever disagree, the code is right — fix
the document in the same PR.
