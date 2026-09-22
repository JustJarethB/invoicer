# Error capture: `rethrowError` + route error boundary (PR 51 feedback, G2)

Owner direction: 4036682063 ("this above error should be captured by the event bus... error boundaries should be employed so that no error goes un-captured") and 4036756544 ("a `rethrowError` helper which populates event bus fields and then throws to a parental boundary"). Source anchor: the not-found throw inside `makePayment` in `app/routes/invoices.tsx`.

## The helper — `app/utils/events.ts`

`rethrowError(bus, event, error)` publishes the failure, then throws the original error toward the parental boundary:

- Severity is always `"error"`; `message` defaults to `errorMessage(error)`; the caught value wins `context.error`, merged with the caller's context and normalised by the existing publish path.
- Exactly-once: a module-level `WeakSet` of already-published errors backs `hasBeenPublished(error)`. A second helper call — or a parental catch/boundary that publishes — for the same caught value is skipped. The WeakSet marks objects only; thrown primitives cannot be marked, so helper sites always pass `Error` objects.
- The throw is the original object, never a wrapper, so parental catches keep their `instanceof`/message checks.
- The publish half is split out as `publishError(bus, event, error)` (publish + mark, no throw) for callers that need to publish while keeping control of control flow; `rethrowError` is `publishError` + `throw error`.
- Known edge: exactly-once is identity-based. React may attempt an error render more than once, and a component that constructs a fresh `Error` per attempt can produce one event per attempt. `rethrowError` sites — the same object rethrown toward the boundary — are the exactly-once path.

## Two capture paths (boundaries do not catch handler throws)

React Router error boundaries catch loader, action and render errors. They do not catch errors thrown from async event handlers, so "no error goes un-captured" needs both:

1. **Handler path** — the flagged site. `makePayment`'s not-found throw (`app/routes/invoices.tsx`) becomes `rethrowError(eventBus, { type: "payment", context: { invoiceId, action: "failed" } }, new Error(...))`. The publish happens at the source; the throw lands in the parental catch, `PaymentModal.submit`. That catch keeps its UX job (`setError`, reset submitting) and publishes only when `hasBeenPublished(e)` is false — throws that did not go through the helper (e.g. the invalid-amount guard) stay captured, helper sites publish exactly once.
2. **Route path** — `app/routes/invoices.tsx` exports an `ErrorBoundary` (`Route.ErrorBoundaryProps`). React Router delivers the error through `useRouteError` (the `error` prop is the framework-mode fallback; never a conditional hook). The boundary defers one `invoice`/`route-error` publish with `queueMicrotask(publishError(...))` — bus listeners such as Toaster may call `setState`, which is illegal in another component's render — then rethrows the original error, including `isRouteErrorResponse` values. The publish is client-side only (`typeof window !== "undefined"`, the root.tsx sink guard): the server's bus has no consumer, so SSR render failures stay on the SSR error path instead of pooling in an unreachable replay buffer. A boundary's own render throw propagates to the ancestor boundary, so the existing root boundary (`app/root.tsx`, `ErrorBoundary`) renders the visual fallback and 404 handling is preserved. `app/routes.ts` is unchanged: a per-route module `ErrorBoundary` export is the React Router v7 framework-mode mechanism — the equivalent of `errorElement` in config mode.

## Coexistence with the per-site try/catch from the migration

The rule is one publish per error: at the source (`rethrowError`) or at the parental catch/boundary (`hasBeenPublished` guard) — never both. Existing catch-and-publish sites (`Autosave`, `SaveClientModal`, `deleteInvoice`, `makePayment`'s db-failure path) are unchanged; converting them is the follow-up flagged in LEDGER G2. G3's commit-on-success rules survive: the boundary changes where an error surfaces, not when optimistic state commits.

## Event vocabulary

`EVENT_TYPES` is not extended. Boundary events reuse the `invoice` domain key with `context.action: "route-error"` and `context.boundary: "invoices"`, consistent with the G1 redesign (qualifiers live in `context`). Extending the union belongs to the events-api card, not this one. Boot diagnostics stay as they are (`app/utils/eventLogging.ts`, non-replayable console sink); events published while no replay-capable surface is subscribed buffer for replay (cap 100), so a route error before the Toaster mounts is still delivered.
