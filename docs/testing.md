# Testing

Vitest 5 with two projects (see `vitest.config.mts`).

```bash
pnpm test                # both projects
pnpm test:unit           # packages/**/*.test.ts + tests/src/unit
pnpm test:integration    # tests/src/integration (needs TEST_DATABASE_URL)
```

## Unit (no database)

| File | Covers |
|---|---|
| `tests/src/unit/shared.test.ts` | CID formatting, timezone resolution (city/region/country, never assumes the exporter zone), working hours and DST, scrypt passwords, AES-GCM secrets, social URL parsing, phone/WhatsApp/email extraction, SSRF guard |
| `tests/src/unit/discovery.test.ts` | Query parsing, criteria merging, normalization with contact sources, search-engine snippet parsing, batch dedupe and fuzzy matching, scoring, hard filters, orchestrator strategy order |
| `tests/src/unit/ai-and-messaging.test.ts` | Business-rule validation (invented prices/MOQ/certifications/delivery/relationships, prohibited phrases, placeholders), escalation flags, knowledge chunking, retry policy by error class, Apify DM result interpretation, Meta signature/verification/OAuth-state security |

## Integration (real MySQL)

`tests/src/integration/mvp-workflow.test.ts` runs the acceptance workflow with in-memory fakes for Apify and the AI provider (`setDiscoveryProvidersForTests`, `setAIProviderForTests`) while using the real services, Prisma and job runner:

1. search -> normalize -> dedupe -> persist (location never invented)
2. second search matches existing leads
3. save -> add to business -> sequential CIDs, repeated add returns existing clients
4. concurrent CID allocation stays unique
5. AI first message uses company facts, passes rule validation, logs the action
6. automation with no provider explains why; manual send records the message and updates the client
7. extension online -> job queued through the extension provider
8. inbound reply -> intent classified -> copilot suggestion awaiting approval
9. do-not-contact and rate limits block sends
10. Meta webhook idempotency, client creation for unknown senders, provider capability
11. AI unavailable -> job fails with a clear error, conversation flagged for a human
12. scheduler enqueues due scheduled messages exactly once (dedupe keys), policy loads follow-up days

Setup: create an empty database (e.g. `oses_j_test`), set `TEST_DATABASE_URL` in `.env`; the global setup applies migrations with `prisma migrate deploy` before the suite runs. The suite creates its own organization and removes it afterwards.

## Manual smoke test

1. `pnpm dev`, log in with the seeded demo account.
2. Search "New apparel brands in New York" (without an Apify token the run completes with a warning).
3. Create a client manually with an Instagram username, generate a message (requires an AI key) or write one, send it manually, log an inbound reply, watch the AI status in the inbox.
4. Pair the extension (Settings > Automation) and send with delivery = automation: the job appears in the extension popup and the message status updates when the result arrives.
