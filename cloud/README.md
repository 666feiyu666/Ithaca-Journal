# Ithaca Journal Cloud — C0

This directory contains the invite-only Web vertical slice. It uses Cloudflare Workers Static Assets, a Worker API, D1, and Cloudflare Access. It remains intentionally separate from the frozen Electron paper artifact.

## Privacy boundary

C0 stores journal bodies in server-readable form (`encryption_version = 0`). The identity-loading surface and application navigation disclose this boundary. Journal bodies must never be included in application logs. Client-side encryption is a later design phase, not an implied property of this build.

## Authentication model

- Remote `staging` and `production` use Cloudflare Access.
- The Access application protects the complete Worker hostname.
- An Access Allow policy contains the explicitly invited email addresses and requires the Email one-time PIN login method.
- The Worker independently verifies `Cf-Access-Jwt-Assertion`, including its signature, issuer, audience, expiry, subject, and email.
- D1 maps the stable Access `sub` claim to `users.access_subject`; email is display and migration data, not the authorization key.
- Local development uses an isolated development subject and never sends a real email code. Development authentication fails closed on non-localhost hostnames.

The application does not create invite codes, passwords, or login sessions. Cloudflare Access owns OTP delivery and its authentication cookie.

## Local setup

```powershell
npm install
npm run types
npm run db:migrate:local
npm run dev
```

Open the localhost URL printed by Wrangler. The default local identity is:

```text
subject: dev:local-developer
email: local@ithaca.invalid
```

Local users and journal entries persist under `.wrangler/state/`. No Cloudflare account or OTP is required. Tests can select additional isolated users with `X-Ithaca-Dev-User` and `X-Ithaca-Dev-Email`; these headers are accepted only while `AUTH_MODE=development` and the request hostname is localhost, `127.0.0.1`, or `[::1]`.

## Verification

```powershell
npm run check
npm test
npm run build
```

`npm run build` is a dry run against the deliberately non-deployable root environment. Remote deployment scripts always select an explicit Wrangler environment.

## Remote Access setup

Before deploying an environment:

1. Create or select its D1 database.
2. Create a Cloudflare Access self-hosted application covering the complete Worker hostname.
3. Enable Email one-time PIN as an identity provider.
4. Restrict the application to the Email one-time PIN identity provider, enable automatic redirect, and add an Allow policy whose Include rule lists only approved email addresses.
5. Copy the Zero Trust team domain into `TEAM_DOMAIN` and the Access application audience into `POLICY_AUD` for that Wrangler environment.
6. Apply migrations, deploy, and verify that an unauthenticated request is redirected by Access, an invited email can read and write, and an unlisted email is denied.

Any environment with empty `TEAM_DOMAIN` and `POLICY_AUD` values intentionally fails closed until its Access application is configured. The environment-specific deployment scripts validate these values and the D1 ID before uploading. Neither Access value is a secret, but the email allowlist and authentication state remain in Cloudflare rather than in this repository.

## Environments

- `local`: local D1 and localhost-only development identity.
- `staging`: deployed at `https://ithaca-journal-cloud-staging.feiyut666.workers.dev`, backed by an independent APAC D1 and the `Ithaca Journal Staging` Access application, `AUTH_MODE=access`.
- `production`: independent D1, invite-only real testing, `AUTH_MODE=access`.

Apply migrations before deploying each remote environment:

```powershell
npm run db:migrate:staging
npm run deploy:staging
```

Production has deliberately not been provisioned. Before its first deployment, create `ithaca-journal-production`, add its `database_id` to `env.production`, configure its own Access application and audience, apply migrations, and review the server-readable consent text with testers.

## Migration from application invite codes

Migration `0002_access_identity.sql` adds the Access subject mapping and removes the obsolete `invites` and `sessions` tables. Existing users and journal entries remain intact. On the first Access request, an existing user with the same verified email and no previous Access binding is linked to that Access `sub`; conflicting existing bindings fail closed and require administrator review.
