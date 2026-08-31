# Refactor Round 4 — Final consistency pass

Date: 2026-08-30
Status: unstaged, all gates green (typecheck clean; unit 36 passed / 1 skipped; integration 5 passed; lint 0 errors, 0 unused-vars on touched files).

Smallest round yet. One theme: finish the Address seam started in round 2 by making `data/address` its single home.

## Changes

**One home for Address extraction.** Round 2 introduced two helpers with overlapping jobs:
- `addressFromRecord(record)` — the real conversion (record → Address)
- `formJsonAddress(form)` — a thin async wrapper that lived in `utils/formJson.tsx`

The wrapper was only a pass-through, and because it lived in `utils/formJson` it created a data→utils import (and a data↔utils cycle the moment ManualSave switched to the sync form). Consolidated:

- `formJsonAddress` moved to `app/data/address.ts` and made **synchronous**. It now reads only the five fields Address knows about (`name`/`streetAddress`/`city`/`county`/`postCode`) directly from `FormData`, so it cannot pick up unrelated inputs the way a generic form-to-record helper can — a small hardening, not just a tidy-up.
- Removal from `utils/formJson.tsx` leaves that module focused on Blob→base64 file handling, which is its actual job.
- Three callers now all import from `data/address`: `ManualSave` (via `addressFromRecord` on the change/save paths + `formJsonAddress` in ClientModal), `routes/clients.tsx` (`formJsonAddress`), and `routes/invoice.tsx` (`addressFromRecord`).

## Why this is the stopping point

Scanning the rest of the tree after rounds 1–4:

- **Money** is numeric past the form boundary; `linePrice`/`invoiceTotal`/`paymentStatusOf` are pure and unit-tested (`data/invoice.test.ts`, `parseCurrency.test.ts`).
- **Domain types** are canonical in `app/data/`. No duplicated `Invoice`/`Payment` declarations in routes.
- **No `as unknown as` casts remain** in app source.
- **IDs** are crypto UUIDs everywhere (invoices, line items, clients). The millisecond-collision class is gone.
- **Payment entry** is a validated modal, not `prompt()`.
- The remaining TODOs are product decisions, not code quality: the disabled `TutorialWizard`, `toast` for the save confirmation, the generalized-`ManualSave` question. Those belong to you, not me.
- The one thing I keep consciously deferring is `Autosave`'s generic `onChange(record)` interface — it's clean enough after round 2's extractor split that inlining it would be churn without a design for the save affordance.

Further rounds now would be style churn, not quality. I'm happy to stop here; all rounds sit unstaged as the `git diff` for you to review in one pass.

## Cumulative diff across rounds 1–4

25 files changed, +273 / -320. Net removal while adding: a domain module (`data/invoice.ts`), an address extraction seam (`data/address.ts`), a payment extractor, a payment modal, and 12 new domain tests.
