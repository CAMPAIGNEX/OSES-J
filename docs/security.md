# Security

## Authentication and sessions

- Passwords are hashed with scrypt (N=16384, r=8, p=1, 32-byte salt) and compared in constant time.
- Sessions are opaque random tokens stored **hashed** (`Session.tokenHash`); the cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production, 30-day sliding expiry.
- Login is rate limited per IP (15 attempts per minute, in-memory window; add a reverse-proxy limit for multi-instance deployments) and failed attempts are audited.

## Platform operators

Users with `isSuperAdmin` (bootstrapped from `SUPER_ADMIN_EMAILS`) can open the OS-Panel across all organizations. Non-operators receive 404s for the panel and its API; every operator action is audited with the operator email. Suspended organizations are blocked at the API layer (`ORG_SUSPENDED`), not only in the UI.

## Multi-tenancy

Every service takes `{ organizationId, userId }` from the session (`withApi`). Organization ids are never read from the request body or query. Roles (`OWNER`, `ADMIN`, `MEMBER`) gate settings, providers, exports and automation controls.

## Secrets at rest

Apify tokens, AI keys and Meta page tokens are encrypted with AES-256-GCM (`encryptSecret`, key = `ENCRYPTION_KEY`, versioned `v1.` prefix, random IV). Logs redact known secret fields. Rotate the key by decrypting with the old key and re-encrypting (a maintenance script can be added; the format is versioned for that purpose).

## CSRF and origin checks

Mutating API calls must carry an `Origin` (or `Referer`) matching `APP_URL` / the request host; browser clients send it automatically. Bearer-authenticated endpoints (extension) and signed webhooks are exempt from cookie CSRF because they do not use cookies.

## Extension

Pairing codes are single-use, hashed, valid for 10 minutes. Access tokens are short-lived (1 h) and refresh tokens (30 days) are rotated on every refresh; both are stored as SHA-256 hashes. Devices can be disabled from Settings > Automation. The extension never receives the OSES J password or any social-media credential.

## Webhooks

`X-Hub-Signature-256` is verified with `META_APP_SECRET` over the raw request body (constant-time compare). Events are idempotent by message id.

## Outbound HTTP (SSRF)

Website extraction and any user-supplied URL fetch pass through `assertPublicHttpUrl`: only `http(s)`, DNS-resolved addresses must be public (loopback, RFC1918, link-local, CGNAT, multicast, IPv6 ULA blocked), redirects are re-validated, response size and time are capped, and only HTML content types are parsed.

## Internal endpoints

`/api/internal/jobs/tick` requires `Authorization: Bearer $INTERNAL_JOB_SECRET`. `/api/health` is unauthenticated and reveals only database reachability and the runner mode.

## Data protection

- Contacts store their source and confidence; only public business information is collected.
- Do-not-contact and opt-out flags are enforced at the service level (not just the UI).
- Trash keeps deleted items for 7 days before permanent purge; audit logs record who changed what.
- Uploaded documents are stored outside the web root (`STORAGE_DIR`) and served through an authenticated route.

## Headers

`next.config.ts` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy`. A Content-Security-Policy is not set yet; add one at the reverse proxy once the allowed script sources are settled.
