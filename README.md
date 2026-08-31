# Bashosho OS

Bashosho OS is the operational management system for [Bashosho Talents CBO](https://www.bashoshotalents.co.ke) — a community-based organization in Kiambiu, Nairobi working in forum theatre, film, and participatory arts on GBV awareness, SRHR, and mental health.

It replaces WhatsApp threads, paper registers, and scattered spreadsheets with one system for members, projects, activities, attendance, M&E, finance, grants, documents, and the organization's public website.

## Tech stack

- **Frontend:** React 19 + TypeScript, Vite, Tailwind
- **Backend:** Express (TypeScript), bundled with esbuild
- **Database:** Firebase Firestore, accessed exclusively through the Admin SDK on the server — the client never talks to Firestore directly (Firestore security rules deny all direct reads/writes by design)
- **AI:** Google Gemini, used for AI-assisted drafting (proposals, reports, letters) — always produced as a labeled draft requiring human review, never auto-published
- **Payments:** Safaricom Daraja (M-Pesa STK Push), with a manual "mark as paid" fallback when Daraja isn't configured

## Running locally

**Prerequisites:** Node.js 22 or later (required by `firebase-admin`).

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in what you need. At minimum for basic local development:
   - `JWT_SECRET` and `VERIFICATION_SECRET` — generate with `openssl rand -hex 32`
   - `FORCE_MOCK_FIRESTORE=true` — skips any real Firebase/Google Cloud connection and stores data in a local `local-firestore.json` file instead, so you don't need a real Firebase project just to run the app
   - `GEMINI_API_KEY` — only needed if you want AI-drafting features to actually call Gemini rather than fall back to a local simulator
   - See `.env.example` for the full list, including M-Pesa (Daraja), reCAPTCHA, and production Firestore configuration.
3. Run the dev server:
   ```
   npm run dev
   ```

## Building for production

```
npm run build      # builds the client (Vite) and bundles the server (esbuild) into dist/
npm run test:finance   # runs the automated regression tests for the financial calculation engine
```

The Dockerfile builds and runs on `node:22-slim` to match `firebase-admin`'s minimum supported Node version.

## Project structure

- `server.ts` — the Express API and all business logic
- `financialCalculations.ts` — the performance-settlement and membership-deduction math, kept separate specifically so it has its own test coverage independent of the server
- `src/` — the React frontend
- `scripts/` — standalone regression scripts (run with `npx tsx scripts/<name>.ts`), not a full test framework
