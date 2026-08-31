# Refactor Round 3 — Final Quality pass

Date: 2026-08-30
Status: unstaged, all gates green (typecheck clean; unit 36 passed / 1 skipped; integration 5 passed; lint 0 errors).

Pass with fresh eyes over the round-2 state. Targets were the leftovers that round 1 (domain/typing) and round 2 (address seam, casts) deliberately deferred, plus a real ID-collision bug uncovered along the way. Round 3 is smaller than the last two: the codebase is mostly in shape now, and what's left is correctness and a11y, not structure.

## Changes

### 1. Timestamp IDs → `randomUUID()` (correctness)
`invoice.tsx` used `` `${Date.now()}`.substring(0,10) `` — a *truncated* millisecond timestamp — as the invoice key; `clients.tsx` and `ManualSave` used `` `${Date.now()}` `` for client IDs. Two saves inside the same millisecond collide, and in `clients.tsx` the collision turns the new client into an overwrite of the previous one (because `saveClient` keys on the id) — silent data loss. All three now use the crypto-backed `randomUUID()` from `app/utils/uuid.ts` (which already falls back correctly under jsdom on Node 20):
- `app/routes/invoice.tsx:53` — invoice id
- `app/routes/clients.tsx:13` — `newClient()`
- `app/routes/clients.tsx:55` — fallback id on save
- `app/components/home/ManualSave.tsx:65` — client id

This also makes every ID in the app uniform (invoice + line items + clients all UUID-shaped), which simplifies reasoning about localStorage keys.

### 2. `clients.tsx` form extraction (kills the last rest-spread cast)
`onSubmit` was the one remaining caller doing the `const { contactName, phone, email, ...address } = await formJson<...>` trick — implicitly trusting that every leftover field was an address field. Replaced with an explicit split: `formJson<Pick<Client, "contactName"|"phone"|"email">>` for the scalar fields and `formJsonAddress` for the address part. Now the clients page uses the same canonical extractor as the invoice and ManualSave pages.

### 3. `DropdownButton` was not dismissable (a11y)
The client picker opened but never closed except by picking an option — no Escape, no click-outside. Added a `useEffect` (guarded on `open`) that registers `keydown`→Escape and `pointerdown`→outside-click handlers and tears them down on close, plus `aria-expanded`/`aria-haspopup="listbox"` on the trigger and `role="listbox"`/`role="option"` on the menu so assistive technology can announce state.

### 4. `Inputs/index.tsx`: drop the `children={...}` prop pattern
`<Prefix children={prefix} />` passed children as an explicit prop — works, but it hides the tree shape from readers and from React DevTools. Now `<Prefix>{prefix}</Prefix>` / `<Suffix>{suffix}</Suffix>`. No behaviour change.

## Verified, not changed (deliberately)

- **Blob-URL leak fix** in `Inputs/index.tsx` (from merged origin/main #39). Confirmed intact — my Prefix edit sat on top of it cleanly. No double-application.
- **`Autosave`** still has a generic `onChange(record)` interface. I again chose _not_ to inline it; the record boundary is now typed correctly at the single call site that needs narrowing. Worth a dedicated pass only if you want the save affordance designed, which is a UX call, not a code-quality one.
- **TutorialWizard** — disabled-by-`showTutorial=false` + commented init, with a switch keyed on `4.5` (a non-integer case). It's dead-but-harmless scaffolding for a feature you may want back (the git history shows it was deliberately disabled, not abandoned). Deleting a product decision is not a code-quality call, so I left it and noted it.

## Cumulative diff across rounds 1–3

All three passes are in the working tree, unstaged, on top of merged `origin/main`. Nothing committed — reviewing the full delta in `git diff` is the intended path.
