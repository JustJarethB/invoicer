# Glossary

Use these exact terms in code, tests, issue titles and PR
descriptions. No synonyms, no abbreviations.

| Concept         | File                  | Names                                          |
| --------------- | --------------------- | ---------------------------------------------- |
| Invoice         | `app/data/invoice.ts` | `Invoice`, `invoiceTotal`, `paymentStatusOf`   |
| Line item       | `app/data/invoice.ts` | `LineItem`, `linePrice`                        |
| Payment         | `app/data/invoice.ts` | `Payment`, `PaymentStatus`                     |
| Charge type     | `app/data/invoice.ts` | `ChargeType`, `chargeTypes`                    |
| Client          | `app/data/client.ts`  | `Client`, `NULL_CLIENT`, `saveClient`          |
| Address         | `app/data/address.ts` | `Address`, `emptyAddress`, `addressFromRecord` |
| Payment details | `app/data/payment.ts` | `PaymentDetails`, `paymentDetailsFromRecord`   |

A line's contribution to the invoice total is its charge type's
calculation: Service/Rental/Expense bill `qty × unitPrice`; Discount
subtracts `unitPrice` flat and ignores qty.
