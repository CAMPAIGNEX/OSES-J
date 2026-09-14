# Messaging

## Model

- `Conversation` — one per client + channel (Instagram / Facebook); tracks counters, last activity, AI status, intent, summary and human-review flags. Official-API threads carry `externalThreadId`.
- `Message` — direction (`INBOUND` / `OUTBOUND`), author (`USER`, `AI`, `SYSTEM`, `CLIENT`), status (`DRAFT`, `PENDING_APPROVAL`, `QUEUED`, `SENDING`, `SENT`, `DELIVERED`, `SEEN`, `FAILED`, `UNAVAILABLE`, `CANCELLED`), provider key, provider/external ids, AI metadata (`aiGenerated`, `aiModel`, `aiActionLogId`), `meta.decision` (which providers were considered and why).
- `ScheduledMessage` — UTC instant + the timezone/mode it was computed from; cancelled automatically when the client replies (follow-ups), opts out or is deleted.
- `MessageJob` — delivery job for asynchronous providers with the state machine `QUEUED → CLAIMED → OPENING_TARGET → TARGET_FOUND → COMPOSER_FOUND → SENDING → SENT | FAILED | RETRYING | BLOCKED | REQUIRES_USER | CANCELLED`.

Status is never fabricated: manual and extension sends show "Sent · status unavailable"; only the official Meta API reports delivered/seen.

## Sending

`createOutboundMessage` (packages/messaging/src/message-service.ts):

1. Checks do-not-contact and organization rate limits (`messagesPerHour`, `messagesPerDay`).
2. Creates the `Message` (or parks it as `PENDING_APPROVAL` when approval is required).
3. `delivery = manual` → marks it `SENT` via provider `manual`, records activity/usage/audit and returns the platform URL to open.
4. `delivery = automation` → `resolveMessagingProvider` picks official Meta → extension → Apify → manual; the chosen provider enqueues a `MessageJob`; the decision is stored on the message. When nothing can send, the message becomes `UNAVAILABLE` with the reason and an "Open in Instagram/Facebook" fallback.

`recordJobResult` applies job outcomes to the message, conversation, client (`lastContactedAt`, status `CONTACTED`) and activity timeline, and stores thread references reported by the provider.

## Scheduling

`scheduleMessage` converts the wall-clock time chosen by the user into UTC using the requested mode: client timezone (resolved from location), exporter timezone, or a custom zone. The scheduler tick turns due rows into `SCHEDULED_MESSAGE_JOB`s (dedupe key `scheduled:<id>`); AI-created messages are pushed to the next working-hours slot when the window is closed.

## Inbox

`GET /api/conversations` supports search, channel, unread, AI status, client status, tags and status filters. The conversation view shows every message with author, timestamps, delivery states where available, attachments, approvals (`Approve & send`, `Send myself`, `Reject`), scheduled messages, AI summary, intent, and a composer with copilot suggestions. Messages exchanged directly in Instagram/Facebook can be logged manually; logged inbound messages trigger the AI reply pipeline.

## Providers

| Provider | Key | Cold outreach | Status tracking | Requirements |
|---|---|---|---|---|
| Manual | `manual` | yes (user does it) | no | — |
| Browser extension | `extension` | yes | no | paired device online, logged in |
| Apify DM Actor | `apify` | yes | no | token + `MESSAGING` provider config |
| Meta official | `meta_instagram` / `meta_facebook` | no — replies to existing threads only | delivered/seen via webhooks | connected account + `scopedUserId` |

Capability checks (`canSend`) update `ClientSocialAccount.messagingEligibility` so the UI can show whether a channel is messageable before anyone writes a message.

## Apify messaging provider

The Actor is configured under **Settings → Providers** (domain `MESSAGING`, adapter `generic-dm`) or `APIFY_MESSAGING_ACTOR`. Its input is produced from `settings.inputTemplate` with `{{username}}`, `{{profileUrl}}`, `{{threadUrl}}`, `{{threadId}}`, `{{message}}`. The job runner executes the Actor and interprets its dataset with `settings.successRule` (`item_status` default: an item must explicitly report success; `run_succeeded`: a successful run counts). Unconfirmed sends are marked `REQUIRES_USER` rather than assumed delivered.
