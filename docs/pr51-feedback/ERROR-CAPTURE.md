# Error capture

## Operations and recovery

Use `withErrorReporting(event, operation)` when an operation needs a domain
error notification but has no local recovery. Pass a callback, not an already
started promise, so the helper captures synchronous throws as well as rejected
promises. It returns a promise for the operation's result. A false result stays
false; the caller decides what it means.

On failure, the helper publishes to `eventBus` and rejects with the original
value. Severity is `error`. The optional message overrides the error's message;
context keeps the diagnostic error text. The caller does not need a catch.

Keep a local catch when it changes recovery behavior:

- `PaymentModal.submit` reports payment failures, shows inline diagnostic text,
  and clears the submitting state. `makePayment` lets exceptions reach that
  caller without an intermediate reporting wrapper. Invalid input stays local
  to the modal and does not publish.
- Autosave warns once per failure streak and clears its spinner.
- Client and invoice loading retain warning severity and leave the view usable.

`publishError(bus, event, error)` supports those catches and route boundaries
without changing control flow. It suppresses repeat reports of the same object
through a shared WeakSet. Primitive rejection values cannot be deduplicated by
that WeakSet. A reused Error object is reported only once, even across operations.

## React boundaries and uncaught rejections

React Router error boundaries catch loader, action and render failures. They do
not catch async event-handler failures. A rejected operation reaches an awaited
caller's catch, or the browser's `unhandledrejection` listener when nobody awaits
it. The global listener reports otherwise unreported errors under the `app`
domain. It does not prevent the browser's default console diagnostics.

Route boundaries defer reporting with `queueMicrotask` because event subscribers
can update React state. The invoices boundary rethrows to the root boundary,
which renders the fallback. Shared error identity prevents duplicate reports.
The root boundary does not publish navigational 404s.

Unwrapped synchronous event-handler errors are outside these capture paths.
The global listener also has no rate limit for distinct errors.

## Verification

The utility tests cover results, synchronous throws, rejections, error identity,
and nested reporting. Component tests cover recovery and success-only UI updates.

jsdom does not deliver floating rejections to `window.unhandledrejection`.
`eventLogging.test.ts` therefore dispatches synthetic rejection events.
`e2e/flows/global-rejection-capture.spec.ts` tests real browser delivery, one error
toast and an open modal after a failed client save, no success toast on failure,
and clean navigation. It uses real components and only mocks storage failure.
