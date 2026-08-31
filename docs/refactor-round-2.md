# Refactor Round 2 — Self-Review Pass

Date: 2026-08-30
Status: unstaged, all gates green (typecheck clean; unit 36 passed / 1 skipped; integration 5 passed; lint 0 errors).

Trigger: after the first round of changes (domain types, numeric money, deletions) I re-read the new state critically. Two classes of problem remained.

## What the re-review found

### A. The address seam was still shallow (the worst leftover)
`AddressPanel` renders five named inputs (`name`, `streetAddress`, `city`, `county`, `postCode`), and **four separate call sites** each hand-extracted those fields and cast the result:
- `routes/invoice.tsx` — `setFrom(from as unknown as Address)` and `setTo(to as unknown as Address)`
- `ManualSave.tsx` — `formJson<Address>` then `setSaveData(data as unknown as Address)`, and `await formJson<Address>` in `ClientModal`
- `routes/clients.tsx` — rest-spread `{ contactName, phone, email, ...address }`

The field-name list was duplicated knowledge. Every caller lying with `as unknown as` is the type system reporting a misplaced seam.

**Fix:** one extractor per shape, living with its type.
- `app/data/address.ts` → `addressFromRecord(record)` (defaults absent fields to `""`)
- `app/utils/formJson.tsx` → `formJsonAddress(form)`
- `app/data/payment.ts` → `paymentDetailsFromRecord(record)`
- `routes/invoice.tsx` → `logoFromRecord(record)` (single-field, co-located)

All four call sites now call an extractor on a plain record. **Zero `as unknown as` casts remain in app source.**

### B. Smaller bugs/cruft from round 1

1. **`ManualSave.onSave` was missing `await`** — `const data = formJson<Address>(formRef.current)` stored a `Promise` in state; rendering gated on truthiness hid it. Now `setSaveData(await formJsonAddress(...))`.
2. **Double `new Date().getTime()` id in `ClientModal`** — the object key and the `saveClient` key could differ across a millisecond boundary. Single `id` const now.
3. **`ManualSave` `name` prop was dead** — the save path it was for was deleted in round 1. Prop removed; sole caller (`invoice.tsx`) updated. Also dropped a now-unused `logger` import.
4. **`PaidStatus summary={{ ..., totalPaid: 0 }}` lie** — constructed a fake summary discarding real `totalPaid`. Now `summary={paymentStatusOf(invoice)}` (one extra computation, worth the honesty).
5. **Raw money not formatted on the invoices list** — `£ {totalDue}`, `£ {due}`, expanded `Total Due`, per-line `unitPrice`, and modal `summary.due` rendered raw numbers (`£ 300` instead of `£ 300.00`, NaN risk on legacy string data). All now go through `formatCurrency`.

## Deliberately left for later

- **`Autosave` still has a generic `onChange(record)` interface.** The wrapper earns less than its interface (it is form + `formJson` + `db.save`), but only two call sites use it and deleting it forces a decision about inline save affordances (the spinner icon). Out of a clean-up pass's scope. It is typed *enough* now that callers no longer cast.
- `formatCurrency`/`parseCurrency` are the formatting/parse boundary pair but are not unified into one "money" module. Not worth it at two functions each.
- No snapshot/e2e run locally (Playwright Chromium crashes on this machine); rely on CI for the visual pass after push.

## Cumulative diff across both rounds

22 files changed, +222 / -312. Net removal of ~90 lines while adding a domain module (`data/invoice.ts`), an address extractor, a payment extractor, a payment modal, and 12 new domain tests.
