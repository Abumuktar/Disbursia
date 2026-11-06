# Disbursia

Bulk disbursement platform for the **Government of Katsina State, Office of the Accountant-General**.
It pays thousands of beneficiaries in one run, and every payment is **verified, authorized and receipted**.

## What's in the box

| Area | What it does |
| --- | --- |
| **Landing page** (`/`) | Public introduction: problem and solution, how it works, safeguards, programmes, pilot targets. Includes scroll-reveal animations. |
| **Sign in** | Sole administrator. Face scan (face-api, on-device), laptop fingerprint (WebAuthn platform authenticator, signature verified against the enrolled public key), then a 6-digit PIN. Session lasts for the browser tab only. |
| **Dashboard** | Amount credited per month, authorization queue, programme breakdown, and the three pilot success measures from the concept brief. |
| **New disbursement** | Upload a CSV/XLSX schedule (or generate a sample of up to 20,000 rows). Column names are auto-detected, rows are validated and you see a preview. |
| **Verification** | Every row gets a NUBAN check-digit validation and a NIBSS name enquiry. Names are fuzzy-matched regardless of word order. Each row comes out *matched*, *partial* (officer decides), *mismatch* or *invalid* (blocked), or *duplicate*. |
| **Authorization** | The administrator releases the whole batch with PIN + fingerprint (a one-time code is the fallback if no fingerprint is enrolled). A batch can also be rejected with a reason. |
| **Payout** | NIP transfers are sent from the single source account, with live progress. Failed payments are not debited and can be re-run with PIN + fingerprint. |
| **Receipts** | Each credit gets a crested, printable and shareable receipt. It shows the transaction reference, NIP session ID, sender, beneficiary, the authorizing administrator named in full, and a verification code. |
| **Audit trail** | Every action records the actor, the time, and the state before and after. Entries are SHA-256 hash-chained, a one-click integrity check is available, and the log exports to CSV. |
| **Programmes** | Programme list with **Add programme** (name, code, agency, enrolled beneficiaries, usual amount). |
| **Settings** | Source account (**Abucore Enterprises, Sterling Bank**), sign-in security with re-enrollment, payment rules. |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/
```

Sign in as the administrator (Abubakar Muktar). On first use you enter your PIN, then enroll your face (camera) and your laptop fingerprint (Windows Hello / Touch ID). After that every sign-in is face scan → fingerprint → PIN.
Camera and fingerprint need a secure origin: `localhost` or HTTPS.

## Important notes

- **Bank integration is simulated.** `src/lib/nibss.ts` stands in for the NIBSS Name Enquiry and NIP Funds Transfer APIs. Its responses are deterministic, so demos are repeatable. To go live, replace these two functions with calls through the sponsoring bank's gateway, and move state, PIN checks, OTP delivery and the audit chain to a server.
- **Data is stored in the browser** (IndexedDB) for this prototype. Use *Reset demo data* on the sign-in page to start again.
- **Source account**: Abucore Enterprises, Sterling Bank, `0147716203`, with an opening balance of ₦18,000,000.00 (`SOURCE_ACCOUNT` and `OPENING_BALANCE` in `src/lib/seed.ts`).
- **State crest**: put the official artwork at `public/katsina-crest.png`. Until then, a drawn green-and-gold seal is shown. The Disbursia logo is rendered in code (`src/components/Wordmark.tsx`).

## Stack

React 18, TypeScript, Vite, Tailwind CSS, React Router, lucide-react, PapaParse, read-excel-file, idb-keyval.

- **Biometrics run in the browser.** Face matching and the fingerprint key check happen on the device. In production, store the face template and public key on the server and issue sign-in challenges from there.
