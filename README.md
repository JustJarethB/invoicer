# Invoicer

Invoicer is a browser app for making printable invoices and recording payments.
Edit the invoice itself, save it in your browser, then print it for your client.
There is no account to create.

It suits freelancers who need to bill for work, equipment hire and expenses on
the same invoice. Keep your sender and payment details for the next invoice,
and record partial payments without a cloud account.

## What you can do

- Edit the invoice reference, date, purchase order and addresses directly.
- Mix Service, Rental, Expense and Discount line items.
- See totals by charge type and the invoice total as you edit.
- Reuse your sender address, payment terms and bank details.
- Save a client address from the invoice and select it on a later invoice.
- Print the current invoice through your browser.
- Keep a list of saved invoices with totals and outstanding balances.
- Record payments and see unpaid, partial, paid and overpaid status.

Payment recording is bookkeeping only. Invoicer does not collect money or
check your bank account.

## Make an invoice

1. Open the invoice editor.
2. Set **Invoice Ref**, **Tax Date** and **PO / Reference**.
   Use a different invoice reference for each invoice.
3. Enter your address in **From** and the client's address in **To**.
4. Add line items with a description, charge type, quantity and unit price.
5. Enter your payment terms, bank details and contact information.
6. Check the totals, then select **Save** to store the invoice.
7. Select **Print** to open the browser's print dialog.
   Choose a printer, or save a PDF if your browser supports it.

Service, Rental and Expense each calculate quantity times unit price.
Discount subtracts the unit price once, regardless of quantity.
For example, three units of Service at £100 with a £25 Discount total £275.

Print or save a PDF while the invoice is still in the editor.
The saved invoice list does not reopen an invoice for editing or printing.

## Reuse your details

Invoicer saves changes to your sender address and payment details for reuse.
It does not automatically save the whole invoice. Use the invoice **Save**
control before leaving the editor.

To keep a client address, use the save control in the **To** panel.
Complete the client modal, then select that client when making another invoice.

## Record a payment

Open the saved invoice list to see invoice totals and the amount due.
Select an unpaid or partial payment status to open the payment modal.
Enter the amount received, then select **Record**.

Record each payment separately when a client pays in instalments.
The balance and status reflect the payments you record.
An amount above the invoice total produces an overpaid status.

## Where your data lives

Invoicer stores saved invoices, clients and reusable details in your browser's
`localStorage`. They belong to that browser profile and site address.
Another browser, device or site address does not share them.

Clearing site data removes these records. Do not treat browser storage as a
backup. Keep printed copies or PDFs of invoices you need to retain.
A PDF preserves the document, not a restorable copy of the app's records.

## Current limits

- Amounts use GBP. There is no currency selector.
- Invoicer does not calculate VAT.
- There are no accounts, cloud sync or shared records.
- There is no backup, import or export of saved app data.
- Saved invoices cannot be reopened for editing or printing.
- Logo upload provides a preview, not durable logo storage.
- Payments are manual records, not bank transfers or payment processing.

Check the invoice and any tax requirements before sending it to a client.

## Run locally

Use Node.js 20.19.2 and pnpm 9.15.4 for the known working development setup.
Clone the repository, install dependencies and start the development server.

```sh
git clone https://github.com/JustJarethB/invoicer.git
cd invoicer
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:5173` after the server starts.
Use the address printed by the server if that port is already in use.

The app uses React, TypeScript, Tailwind CSS and React Router.
It runs as a single-page app with server-side rendering disabled.

## Build for static hosting

```sh
pnpm build
```

Serve the static files in `build/client`.
Configure the host to fall back to `index.html` for app routes.
This lets visitors open routes such as `/invoices` directly.

## Project documentation

- [Domain glossary](CONTEXT.md)
- [Coding practices](docs/agents/coding-practices.md)
- [Testing strategy](TESTING_STRATEGY.md)
- [Issue tracker workflow](docs/agents/issue-tracker.md)
- [React Router documentation](https://reactrouter.com/)
