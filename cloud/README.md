# Ithaca Journal Cloud — C0

This directory contains the first invite-only Web vertical slice. It uses Cloudflare Workers Static Assets, a Worker API, and D1. It is intentionally separate from the frozen Electron paper artifact.

## Privacy boundary

C0 stores journal bodies in server-readable form (`encryption_version = 0`). The interface discloses this before login. Journal bodies must never be included in application logs. Client-side encryption is a later design phase, not an implied property of this build.

## Local setup

```powershell
npm install
npm run types
npm run db:migrate:local
npm run invite -- tester@example.com
npm run dev
```

Copy the generated `INSERT` statement and apply it with Wrangler:

```powershell
npx wrangler d1 execute ithaca-journal-local --local --command "<generated INSERT statement>"
```

The invitation code is printed once and is not stored in plaintext.

## Verification

```powershell
npm run check
npm test
npm run build
```

`npm run build` is a dry run. The deployment scripts are deliberately environment-specific; do not deploy the root Worker accidentally.

## Environments

- `local`: local D1, non-Secure session cookie for `http://localhost`.
- `staging`: independent APAC D1, synthetic content only. Deployed at <https://ithaca-journal-cloud-staging.feiyut666.workers.dev>.
- `production`: independent D1, invite-only real testing.

Apply migrations before deploying each environment:

```powershell
npm run db:migrate:staging
npm run deploy:staging
```

Production has deliberately not been provisioned. Before its first deploy, create `ithaca-journal-production`, add its `database_id` to `env.production`, run `npm run db:migrate:production`, and review the server-readable consent text with testers.
