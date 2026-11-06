# Disbursia

Bulk disbursement platform for the **Government of Katsina State, Office of the Accountant-General**.
It pays thousands of beneficiaries in one run, and every payment is **verified, authorized and receipted**.

## What's in the box

| Area | What it does |
| --- | --- |
| **Landing page** (`/`) | Public introduction: problem and solution, how it works, safeguards, programmes, pilot targets. Includes scroll-reveal animations. |
| **Sign in** | Role-based accounts: Finance Officer, Signatories (Accountant-General, Director of Treasury) and Auditor. |
| **Dashboard** | Amount credited per month, authorization queue, programme breakdown, and the three pilot success measures from the concept brief. |
| **New disbursement** | Upload a CSV/XLSX schedule (or generate a sample of up to 20,000 rows). Column names are auto-detected, rows are validated and you see a preview. |
| **Verification** | Every row gets a NUBAN check-digit validation and a NIBSS name enquiry. Names are fuzzy-matched regardless of word order. Each row comes out *matched*, *partial* (officer decides), *mismatch* or *invalid* (blocked), or *duplicate*. |
| **Authorization** | One PIN plus one SMS OTP authorizes the whole batch. Batches above ₦50m need a second, different signatory, and the officer who prepared a batch cannot sign it. A signatory can also reject a batch, giving a reason. |
| **Payout** | NIP transfers are sent from the single source account, with live progress. Failed payments are not debited and can be re-run with a fresh PIN + OTP. |
| **Receipts** | Each credit gets a crested, printable and shareable receipt. It shows the transaction reference, NIP session ID, sender, beneficiary, the signatories named in full, and a verification code. |
| **Audit trail** | Every action records the actor, the time, and the state before and after. Entries are SHA-256 hash-chained, a one-click integrity check is available, and the log exports to CSV. |
| **Programmes & account** | The four programmes and the sole source account, **Abucore Enterprises, Sterling Bank**. |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/
```

Demo PINs: Aisha (Finance Officer) `1111`, Musa (Accountant-General) `2222`, Zainab (Director of Treasury) `3333`, Ibrahim (Auditor) `4444`.
The OTP is shown as a simulated SMS in the top-right corner.

## Important notes

- **Bank integration is simulated.** `src/lib/nibss.ts` stands in for the NIBSS Name Enquiry and NIP Funds Transfer APIs. Its responses are deterministic, so demos are repeatable. To go live, replace these two functions with calls through the sponsoring bank's gateway, and move state, PIN checks, OTP delivery and the audit chain to a server.
- **Data is stored in the browser** (IndexedDB) for this prototype. Use *Reset demo data* on the sign-in page to start again.
- **Source account number** is a valid-format placeholder (`0087145266`). Set the real Sterling Bank NUBAN in `SOURCE_ACCOUNT` in `src/lib/seed.ts`.
- **State crest**: put the official artwork at `public/katsina-crest.png`. Until then, a drawn green-and-gold seal is shown. The Disbursia logo is rendered in code (`src/components/Wordmark.tsx`).

## Stack

React 18, TypeScript, Vite, Tailwind CSS, React Router, lucide-react, PapaParse, read-excel-file, idb-keyval.
