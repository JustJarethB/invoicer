# Error capture: rethrowError, boundaries, and the global catcher (PR 51 feedback, G2)

Owner direction: 4036682063 ("this above error should be captured by the event
bus... error boundaries should be employed so that no error goes un-captured"),
4036756544 ("a `rethrowError` helper which populates event bus fields and then
throws to a parental boundary"), and the scope ruling of 2026-09-22 10:43
(t_8d10da52 comment): named catch-and-publish sites are converted to the
rethrowError-to-parental-boundary pattern, not left as catch-and-swallow.

## The fix shape

Catch-and-swallow becomes catch-and-rethrow, not catch-removal. React Router
error boundaries cannot catch async event-handler throws, so the local catch
must remain; what changes is what the catch does with the caught value — it
publishes once at the source, then rethrows the original object toward the
parental boundary instead of swallowing it. The owner's 4036756544 endorses
exactly this helper shape.

## The helpers — `app/utils/events.ts`

`rethrowError(bus, event, error)` publishes the failure, then throws the
original error toward the parental boundary (an awaited caller's catch, or a
route ErrorBoundary):

- Severity is always `"error"`; `message` defaults to `errorMessage(error)`
  (events.ts:87 derives it when the caller passes none); the caught value
  wins `context.error`, merged with the caller's context and normalised by
  the publish path (`withNormalisedError`).
- Exactly-once is identity-based: a module-level `WeakSet` of
  already-published values backs `hasBeenPublished(error)`. A second helper
  call — a parental catch, a boundary, or the global catcher — for the same
  caught value is skipped. The WeakSet marks objects only; thrown primitives
  cannot be marked, so helper sites pass `Error` objects. Known edge: React
  may re-render an error more than once, and a component constructing a
  fresh `Error` per attempt produces one event per attempt; `rethrowError`
  sites rethrow the same object and are the guaranteed exactly-once path.
- The throw is the original object, never a wrapper, so parental catches
  keep their instanceof/message checks.
- `publishError(bus, event, error)` is the publish half alone (publish +
  mark, no throw): it derives the message, normalises `context.error`, marks
  the WeakSet, and skips already-published values. Callers that must publish
  inside a catch while keeping control of control flow use it directly;
  `rethrowError` is `publishError` + `throw error`.

## Four capture paths

React Router boundaries catch loader, action and render errors; they do not
catch errors thrown from async event handlers, and an async throw with no
local catch escapes even the boundaries. "No error goes un-captured" needs
four shapes:

1. **Handler catch** — a local catch around an await publishes at the source
   via `rethrowError`, then rethrows toward the parental boundary: an
   awaited caller's catch (`PaymentModal.submit` for `makePayment`), or, for
   fire-and-forget callers, the global catcher (path 4).
2. **Route boundary** — `app/routes/invoices.tsx` exports an ErrorBoundary
   (framework-mode export; `app/routes.ts` is unchanged). It defers one
   `publishError` with `queueMicrotask` — bus listeners such as Toaster call
   setState, which is illegal in another component's render — then rethrows
   so the root boundary renders the fallback. It publishes the route's own
   404 responses; framework-level "no route matched" is handled at root.
3. **Terminal boundary (root)** — `app/root.tsx`'s ErrorBoundary publishes
   non-404 errors and renders the fallback; it never rethrows (no ancestor).
   Its deferred publish rides the same microtask FIFO + WeakSet, so a route
   boundary's already-published error wins and root adds nothing. The
   `clients`/`invoice` routes carry no boundary; root is their capture.
   Navigational 404s skip the publish: expected outcome, the fallback page
   is their capture, and a never-auto-dismissing error toast per mistyped
   URL is noise. Client-only publish: the server's bus has no consumer, so
   SSR failures stay on the SSR error path.
4. **Global rejection catcher** — `root.tsx` registers
   `registerGlobalErrorCapture` (app/utils/eventLogging.ts) beside the boot
   log sink, SSR-guarded and idempotent. A window `unhandledrejection`
   listener publishes type `"app"`, context.action `"unhandled-rejection"`,
   boundary `"global"`, and rides `publishError`. This closes the async
   escape QA probed: a throw with no local catch at all escapes every
   handler catch and every boundary; only this listener sees it. Default
   handling is not prevented — the browser console keeps the live stack.
   The compose with rethrowError sites is exactly-once by the shared
   WeakSet. Two disclosed limits: the catcher has no throttle — repeated
   floating rejections publish one event per occurrence (the Toaster's cap
   bounds the visible surface; the bus and the log see each one) — and sync
   throws inside event handlers stay outside every path here (boundaries do
   not catch them and `unhandledrejection` does not fire), a known limit
   beyond this finding's scope, not silently patched with an `onerror`
   listener.

## Per-site disposition (grep-verified at the fix commits, `2fc14ef`..`5b9e4a1`)

Converted to `rethrowError` (identical explicit messages preserved):

| Site (file:line)                             | Failure                    | Rethrows to                             |
| -------------------------------------------- | -------------------------- | --------------------------------------- |
| `app/routes/invoices.tsx:51`                 | payment, invoice not found | `PaymentModal.submit` catch             |
| `app/routes/invoices.tsx:60`                 | payment, db save rejects   | `PaymentModal.submit` catch             |
| `app/routes/invoices.tsx:86`                 | invoice, db remove rejects | global catcher (fire-and-forget caller) |
| `app/routes/clients.tsx:59`                  | client, save rejects       | global catcher (fire-and-forget caller) |
| `app/routes/clients.tsx:68`                  | client, delete rejects     | global catcher (fire-and-forget caller) |
| `app/routes/invoice.tsx:85`                  | invoice, db save rejects   | global catcher (Controls save button)   |
| `app/components/home/SaveClientModal.tsx:40` | client, save rejects       | global catcher (modal Save button)      |

Deliberately not converted:

- `app/routes/invoices.tsx:277` — `PaymentModal.submit`'s catch. This is the
  parental boundary the `makePayment` rethrows target (QA comment 85: the
  boundary catch "already runs publishError as the safety net"); the catch
  also sets the inline error text and manages the `submitting` state, so it
  is not a publish+swallow site under QA's own conversion rule (comment 85:
  "convert where the catch's only job is publish+swallow"). `publishError`
  stays as the safety net for throws that did not go through the helper
  (the invalid-amount guard; its zero-publish test still holds). OWNER CALL
  FLAGGED: the 10:43 ruling lists "PaymentModal submit" among named sites.
  Converting it has zero capture gain — the rethrown value is already
  published, so the global catcher would dedupe it to a no-op — while every
  modal failure would additionally surface as an uncaught rejection. Kept,
  flagged, revertible on the owner's word.
- `app/routes/invoices.tsx:63` and `:89` — the `!saved` / `!removed`
  false-return branches. No caught value exists to rethrow: the boolean is a
  control signal the caller consumes. Already error severity; unchanged.
- `app/components/home/Autosave.tsx:31` — warning severity behind the G5a
  warn-once-per-streak throttle (QA comment 85 pre-authorises this
  exception: "Autosave needs its local catch (G5a throttle)"). OWNER CALL
  FLAGGED: the 10:43 ruling names Autosave, but converting would force
  error severity (`publishError` forces `"error"`) and publish a
  never-auto-dismissing red toast per failure streak, contradicting the G5a
  warn-once requirement. The ruling postdates the G5a card, so neither
  directive can claim precedence; kept per the G5a card's design, flagged
  for the owner.
- `app/routes/clients.tsx:30` and `app/routes/invoices.tsx:108` — the
  load-failure guards: warning severity for a recoverable corrupt-store
  state; converting would flip them into never-auto-dismissing red toasts.
- `app/db.ts:25` (storage warning) and
  `app/components/Inputs/index.tsx:225` (image debug publish): same severity
  reasoning — `publishError` forces `"error"`, so converting would turn
  recoverable diagnostics into red toasts.

## Deliberate behaviour deltas

- Payment db-failure now also shows the inline modal error text
  (`setError(errorMessage(e))`): the rethrow lands in the modal catch, where
  the old catch-and-swallow surfaced only the bus event. This is the one
  reachable copy delta of the conversion; pinned by
  `app/components/home/notification-flow.test.tsx`.
- The catcher does not `preventDefault()`: the browser's own console entry
  keeps the live stack trace; the bus event carries the message and normalised context.

## Test-environment constraint (why there are two proof layers)

jsdom never delivers a floating rejection to a `window` listener (probe:
listener saw 0 events for a natural float), and vitest fails the whole run
on any natural floating rejection (probe: run exited 1 with unhandled
errors; swapping Node's process listeners did not suppress it). Therefore:

- Unit tests pin the wiring with synthetic `unhandledrejection` dispatch —
  `app/utils/eventLogging.test.ts` covers capture, identity-based dedupe
  against `publishError`, re-registration, the no-window guard, and
  primitive reasons (`errorMessage` handles them; the WeakSet cannot mark
  them).
- The real-browser proof is `e2e/flows/global-rejection-capture.spec.ts`:
  a natural `Promise.reject` with no local catch surfaces one error toast
  (test 1 — proof the catcher attaches in a real browser), the converted
  SaveClientModal catch floats exactly one rejection to window level
  (recorded live in the page) while the toast carries the source publish's
  explicit copy (test 2 — the rethrow + exactly-once compose, end to end),
  and normal navigation across all three routes raises no error toast
  (test 3 — the clean-run invariant the visual-regression suite guards in
  CI; its baselines are not tracked in-repo, so a fresh local checkout must
  seed them once before the visual project can pass — environmental, not a
  regression).

Consequence for re-probing the original finding: a vitest probe (mock
`formJson` to reject, subscribe to the bus) still observes zero events in
jsdom — that is the environment's documented limit, not an unfixed finding.
The e2e spec is the re-answer.

## Event vocabulary

`EVENT_TYPES` carries `app` for harness-level failures that belong to no
single domain (the root boundary's captures and the global catcher's).
Domain keys carry everything with a domain (`invoice`, `payment`, `client`,
...); root's events use `app` with `context.action: "route-error"` and
`context.boundary: "root"`, the catcher uses `context.action:
"unhandled-rejection"`, and the invoices route boundary keeps its
route-scoped `invoice` events. Boot diagnostics stay as they are
(`app/utils/eventLogging.ts`, non-replayable console sink); events published
while no replay-capable surface is subscribed buffer for replay (cap 100),
so an error before the Toaster mounts is still delivered.
