# Coding practices

Rules for LLM agents changing Invoicer. Read before your first change.
The canonical product name is defined in `CONTEXT.md`; spell it
"Invoicer" (the `package.json` package name stays `invoicr`).

Not a style guide (Prettier/ESLint own formatting), not a testing doc
(`TESTING_STRATEGY.md`), not process (`CLAUDE.md`, `docs/agents/`).
This doc is judgement: where code lives, what shape it takes, and which
mistakes this repository has already made and will not make again.

## 1. Prime directives

Ordered; when rules conflict, the earlier wins.

1. **Parse at the boundary, once.** `NumberInput` emits
   `number | undefined`; downstream stays numeric. Uncontrolled form
   strings caused the NaN plague. The render boundary is the input layer
   (`components/Inputs/`) plus the form-to-record readers; everything
   after it sees typed values. localStorage is a boundary too:
   `db.get` returns unvalidated JSON — validate the shape at read; `as`
   on a db result is a seam bug (`invoices.tsx:61` is the live
   candidate).
2. **Types are contracts; never cast.** `as unknown as` is forbidden —
   a cast reports a misplaced seam; move the seam. A narrow `as` is
   tolerated only at a boundary you own (`db.ts` at the `JSON.parse`
   edge), never to silence a mismatch between two of our own types.
3. **One home per concept.** Domain types live in `app/data/`.
4. **Money is a number.** Formatted only at render (`formatCurrency`),
   parsed only at input. Never a string.
5. **Routes are thin.** Fetch, compose, render; derivation is pure
   functions in `app/data/`.
6. **Absence, not empty.** An unset line-item field is a missing
   property (`qty?: number`), never `""`, never a sentinel `0`.
   `Address`/`PaymentDetails` keep `""` defaults as their settled
   representation — do not copy that to new domain types.
7. **Delete more than you add.** Dead code, lie props and shallow
   wrappers were all fixed by deletion.
8. **Interfaces must earn their keep.** A wrapper whose interface is as
   complex as its implementation is deletion debt: delete it when your
   change touches it; do not imitate or extend it (`Autosave`,
   `withLineItemProvider` are the flagged examples).
9. **Components read, they do not compute.** Totals, statuses and
   formatting live in `app/data/` or inline in JSX. Do not create a
   component file that only forwards props — delete or inline it.

## 2. Design patterns

General TS/React community practice, chosen because the codebase
largely follows it already. Where it does not, the pattern names the
file as a migration candidate (e.g. `Button.tsx` in §2.1, `root.tsx`
in §2.4). Write new code in these shapes regardless.

### 2.1. Prefer a lookup table over switch and if chains

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

### 2.2. Prefer type aliases over interface

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

### 2.3. Prefer string-literal unions over enums

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

### 2.4. Write components as arrow functions

Arrow functions with destructured, alias-typed props. Never class
components, `function` declarations, or `React.FC`.

In this repo: `root.tsx` and `routes/invoices.tsx` still declare
components with `function` — migrate them when you touch them.

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

### 2.5. Derive values in render; never mirror them in state

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

### 2.6. Freeze static structures with as const

```ts
// ❌ string[], mutable, no literal types
const columns = ["name", "qty", "price"];
type Column = (typeof columns)[number]; // just string

// ✅ readonly tuple; Column = "name" | "qty" | "price"
const columns = ["name", "qty", "price"] as const;
type Column = (typeof columns)[number];
columns.push("total"); // Error: readonly
```

### 2.7. Derive prop types with Pick and Omit

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

### 2.8. Provide deep data through context with focused hooks

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
`useSetLineItem`, `useDeleteLineItem`. Its context default is
permissive (`[]`, throwing placeholder setters) and has no guard — the
guard-and-throw hook above is the target shape, not the current one.

### 2.9. Use functional state updates, not stale closures

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

### 2.10. Extractors instead of casts

A `FormData`/record must never meet a domain type through `as`. One
extractor per shape, living with its type, normalising defaults once:

```ts
// ❌ the type system is silenced, not convinced
const address = record as unknown as Address;

// ✅ an extractor — the seam that removed every `as unknown as` from app source
export const addressFromRecord = (record: Record<string, string>): Address => ({
  name: record.name ?? "",
  streetAddress: record.streetAddress ?? "",
  city: record.city ?? "",
  county: record.county ?? "",
  postCode: record.postCode ?? "",
});
```

`formJson` returning `Record<string, string>` is the sanctioned generic
reader. Casting its result to a domain type is not: extractors
(`addressFromRecord`, `paymentDetailsFromRecord`, `logoFromRecord`) are
the only bridge from a record to a domain type. Narrow literal casts
(`as const`, `satisfies`) are not this rule's target. Live narrow casts
remain at `app/data/invoice.ts:36` and `LineItem.tsx:46` — replace them
when you touch those files. The `LineItem.tsx:46` cast exists because
`SelectInput` still emits the raw string of its option value; when the
input emits typed values, the cast goes.

## 3. Anti-patterns

Each was a real, merged bug in this repo. Do not reintroduce. Where an
instance survives, the bullet names it: live instances are migration
candidates, not permission.

- **Stringly-typed money** — the NaN plague. Money is `number`.
- **`prompt`/`alert`/`confirm`** — validation belongs in a typed input.
- **Defensive re-parsing downstream** — `Number()` on user input
  outside the input boundary means the boundary leaked. Exemptions:
  `parseCurrency`/`formatCurrency` are the sanctioned parse/format
  pair.
- **`as unknown as`** — add an extractor; move the seam.
- **Nested or chained ternaries** — even the one in `paymentStatusOf`
  is debt, not a pattern; use `if`/`return`.
- **Dead or commented-out code** — delete it. If the block contains
  personal data, deletion is not enough: never commit it in the first
  place, and route a history purge (`git filter-repo` / BFG +
  force-push, coordinated with the repo owner) — public history stays
  public. Live: a commented-out `useEffect` at `TutorialWizard.tsx:10` —
  delete or revive it when you touch the file.
- **Lie props** — a hand-built `summary={{ ..., totalPaid: 0 }}` means
  the interface is wrong; change the interface.
- **Shallow wrappers** — `Autosave`/`withLineItemProvider` are flagged
  debt; do not imitate or extend.
- **Shapes built in more than one place** — `logo: { url: logo }`
  double-wrapped. One constructor per shape, at the boundary. Live:
  `invoice.tsx:67` and `:74` build `{ url }` inline next to
  `logoFromRecord` — route the shape through the constructor when you
  touch it.
- **TODO without an issue link** — file it or do it now. Seven live
  (`invoices.tsx:124` among them): resolve or link them when touched.
- **`new Date().getTime()` ids** — collide within a millisecond; use
  `randomUUID()`. Live at `invoice.tsx:58`, in the invoice-id generator
  itself — migrate when you touch it.
- **Unkeyed lists** — React cannot reconcile them.
- **Blob-URL leaks** — see `ImageInput`'s `releasePreviewImage`.
- **`console.log`** — use `logger`.
- **Prop drilling past two levels** — use the provider pattern.
- **Snapshot tests for everything** — behaviour tests carry the weight.

## 4. Definition of done

All gates green before push; CI re-runs them and adds Playwright:
`pnpm run typecheck`, `lint`, `format:check`, `test:unit`,
`test:integration`. UI changes may require snapshot updates — see
`TESTING_STRATEGY.md` for the update flow before forcing anything.

Before opening the PR: self-review the diff as a stranger would and
delete what you cannot justify in one sentence; introduce no §3
anti-pattern; conventional commit; the PR description explains WHY.

If this document and the code ever disagree, the code is right — fix
the document in the same PR.
