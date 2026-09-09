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

## 7. Design patterns

These rules are general TypeScript/React community practice, not
Invoicr inventions. They are collected here because the codebase
already follows them everywhere — write new code in these shapes so
it matches the tree.

### 7.1. Prefer a lookup table over switch and if chains

Map variants to values with a `const` lookup table — exhaustive at
compile time, and adding a case is adding a row, not a branch.

❌ Bad code

```tsx
type Variant = "success" | "warning" | "danger";

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
```

✅ Good code

```tsx
type Variant = "success" | "warning" | "danger";

const badgeClasses: Record<Variant, string> = {
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
};

// badgeClasses[variant] — a missing row is a compile error.
```

In this repo: `Button.tsx` maps color/size to classes with `switch` —
the live refactor candidate for this rule.

### 7.2. Prefer type aliases over interface

Use `type` aliases: they cannot be silently declaration-merged, and
they express unions, intersections and mapped types `interface` can't.

❌ Bad code

```ts
interface User {
  id: string;
  name: string;
}

interface User {
  // Declaration merging: compiles, and silently changes User
  // for every file in the project.
  email: string;
}
```

✅ Good code

```ts
type User = {
  id: string;
  name: string;
  email: string;
};

// A duplicate `type User` is a compile error — no silent merging.
type Admin = User & { permissions: string[] };
```

### 7.3. Prefer string-literal unions over enums

Use string-literal unions: zero runtime cost, inferred from plain
literals, and callers never import an enum to pass a string.

❌ Bad code

```ts
enum Status {
  Draft = "draft",
  Sent = "sent",
  Paid = "paid",
}

const setStatus = (status: Status): void => {
  /* ... */
};

setStatus("draft"); // Error: not assignable to type Status
setStatus(Status.Draft); // every caller must import the enum
```

✅ Good code

```ts
type Status = "draft" | "sent" | "paid";

const setStatus = (status: Status): void => {
  /* ... */
};

setStatus("draft"); // the literal is the value — nothing to import
```

### 7.4. Write components as arrow functions, never classes or `React.FC`

Write components as arrow functions with destructured, alias-typed
props — never class components, never `function` declarations, never
`React.FC`.

❌ Bad code

```tsx
import { Component } from "react";

class Badge extends Component<{ label: string; count: number }> {
  render() {
    return (
      <span>
        {this.props.label}: {this.props.count}
      </span>
    );
  }
}

// `function` keyword is also out — the repo is 100% arrows:
function Status({ ok }: { ok: boolean }) {
  return <span>{ok ? "✓" : "✗"}</span>;
}
```

✅ Good code

```tsx
type BadgeProps = {
  label: string;
  count: number;
};

const Badge = ({ label, count }: BadgeProps) => {
  return (
    <span>
      {label}: {count}
    </span>
  );
};
```

### 7.5. Provide deep data through context with focused hooks

When data travels through 3+ components that only forward it, provide
it via context and expose one focused hook per operation.

❌ Bad code

```tsx
const App = ({ user }: { user: User }) => <Layout user={user} />;

// A courier, nothing more — Layout does not use `user` itself:
const Layout = ({ user }: { user: User }) => <Header user={user} />;

const Header = ({ user }: { user: User }) => <Avatar name={user.name} />;
```

✅ Good code

```tsx
type Session = { user: { name: string }; logout: () => void };

const SessionContext = createContext<Session | null>(null);

const useSession = (): Session => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be inside SessionProvider");
  return ctx;
};

// One focused hook per operation — Layout and Header forward nothing.
const useCurrentUser = () => useSession().user;
const useLogout = () => useSession().logout;
```

In this repo: `LineItemProvider` exposes `useLineItems`,
`useLineItem`, `useSetLineItem` and `useDeleteLineItem`.

### 7.6. Derive values in render; never mirror them in state

If a value can be computed during render, compute it — mirroring it
in `useState` forks the source of truth and syncs via effects.

❌ Bad code

```tsx
const PriceTag = ({ price }: { price: number }) => {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    setFormatted(`$${price.toFixed(2)}`);
  }, [price]);

  return <span>{formatted}</span>;
};
```

✅ Good code

```tsx
const PriceTag = ({ price }: { price: number }) => {
  // Derived during render — always in sync, no effect needed.
  const formatted = `$${price.toFixed(2)}`;

  return <span>{formatted}</span>;
};
```

### 7.7. Return early with guard clauses

Handle failure first and return or throw immediately, so the happy
path stays flat and reads top to bottom.

❌ Bad code

```tsx
const Profile = ({ user }: { user: User | null }) => {
  if (user) {
    if (user.avatarUrl) {
      return <img src={user.avatarUrl} alt={user.name} />;
    } else {
      return <Placeholder name={user.name} />;
    }
  } else {
    return null;
  }
};
```

✅ Good code

```tsx
const Profile = ({ user }: { user: User | null }) => {
  if (!user) return null;
  if (!user.avatarUrl) return <Placeholder name={user.name} />;

  return <img src={user.avatarUrl} alt={user.name} />;
};
```

### 7.8. Check literal config with satisfies

Check literal config with `satisfies`: it validates the shape while
keeping the inferred narrow types an annotation would widen away.

❌ Bad code

```ts
const theme: Record<string, string | number> = {
  fontFamily: "Inter, sans-serif",
  fontSize: 14,
  lineHeight: 1.5,
};

// The annotation widened every value to string | number.
theme.fontFamily.toUpperCase(); // Error: possibly a number
```

✅ Good code

```ts
const theme = {
  fontFamily: "Inter, sans-serif",
  fontSize: 14,
  lineHeight: 1.5,
} satisfies Record<string, string | number>;

// Checked against the shape, but each value keeps its narrow type.
theme.fontFamily.toUpperCase(); // OK — fontFamily is string
```

In this repo: `chargeTypes satisfies ChargeType[]` in
`data/invoice.ts`; `satisfies RouteConfig` in `routes.ts`.

### 7.9. Model absence with optional fields, not sentinels

Model "not set" with optional fields, never sentinels — `""` and `0`
collide with real values; `undefined` unambiguously means absent.

❌ Bad code

```ts
type Customer = {
  name: string; // "" means "no name given"
  company: string; // "" means "no company"
};

const greet = (c: Customer): string =>
  c.name === "" ? "Hello" : `Hello, ${c.name}`;
```

✅ Good code

```ts
type Customer = {
  name?: string; // undefined means absent — no sentinel needed
  company?: string;
};

const greet = (c: Customer): string => `Hello, ${c.name ?? "there"}`;
```

### 7.10. Freeze static structures with as const

Freeze static lists and objects with `as const` — you get literal
types and read-only enforcement for free.

❌ Bad code

```ts
const columns = ["name", "qty", "price"]; // inferred as string[]

type Column = (typeof columns)[number]; // just string — no help

columns.push("total"); // mutable, and still only string[]
```

✅ Good code

```ts
const columns = ["name", "qty", "price"] as const;

type Column = (typeof columns)[number]; // "name" | "qty" | "price"

columns.push("total"); // Error: the tuple is readonly
```

### 7.11. Derive prop types with Pick and Omit

Project prop types from their source with `Pick`/`Omit`; re-typed
fields drift out of sync with the original.

❌ Bad code

```ts
type InputProps = { value: string; maxLength?: number; placeholder?: string };

type SearchFieldProps = {
  value: string; // copied from InputProps by hand...
  maxLength?: number; // ...and already drifting out of sync
  onSearch: (query: string) => void;
};
```

✅ Good code

```ts
type InputProps = { value: string; maxLength?: number; placeholder?: string };

type SearchFieldProps = Pick<InputProps, "value" | "maxLength"> & {
  onSearch: (query: string) => void;
};

// InputProps changes? SearchFieldProps follows automatically.
```

In this repo: `Pick<ComponentPropsWithoutRef<typeof TextInput>,`
`"maxLength" | "formatOnChange">` in `Inputs/index.tsx`.

### 7.12. Key lists by stable id, never by index

Key list items by a stable id — index keys make React reuse the
wrong DOM node and state when the list reorders or shrinks.

❌ Bad code

```tsx
const ItemList = ({ items }: { items: Item[] }) => (
  <ul>
    {items.map((item, index) => (
      <Row key={index} item={item} />
    ))}
  </ul>
);
```

✅ Good code

```tsx
const ItemList = ({ items }: { items: Item[] }) => (
  <ul>
    {items.map((item) => (
      <Row key={item.id} item={item} />
    ))}
  </ul>
);
```

In this repo: lists key by `item.uuid` and `invoice.id`.

### 7.13. Use functional state updates, not stale closures

When the next state is computed from the previous state, pass an
updater function to the setter — reading the current value from a
closure captures a stale copy.

❌ Bad code

```tsx
const Counter = ({ step }: { step: number }) => {
  const [count, setCount] = useState(0);

  // `count` is the value from this render — a stale copy:
  const increment = () => setCount(count + step);

  const double = () => {
    increment();
    increment(); // both read the same old count — +step once, not twice
  };
};
```

✅ Good code

```tsx
const Counter = ({ step }: { step: number }) => {
  const [count, setCount] = useState(0);

  // The updater always receives the latest state:
  const increment = () => setCount((c) => c + step);

  const double = () => {
    increment();
    increment(); // both updaters queue — applied to the latest value
  };
};
```

In this repo: `setOpen((o) => !o)` in `routes/invoices.tsx`,
`setInvoices((prev) => prev.map(...))` — never read-then-set.

### 7.14. Compose with render props, not boolean props

Replace boolean-prop pyramids with composition: the component owns
the behavior, the caller owns the markup via a render prop.

❌ Bad code

```tsx
type SaveButtonProps = {
  label: string;
  showIcon?: boolean;
  confirmFirst?: boolean;
  fullWidth?: boolean;
  redirectAfter?: boolean;
};

// Every new variation is another boolean; combinations explode.
```

✅ Good code

```tsx
import type { ReactNode } from "react";

type SaveButtonProps = {
  record: { id: string };
  children: (save: () => void, isSaving: boolean) => ReactNode;
};

// SaveButton owns the save flow; callers compose their own markup:
// <SaveButton record={draft}>{(save) => <a onClick={save}>Save</a>}</SaveButton>
```

In this repo: `ManualSave` takes `onSave?: (record, close, onSaved) =>
ReactNode`.

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
