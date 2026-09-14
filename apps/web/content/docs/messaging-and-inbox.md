---
title: Messaging & inbox
section: Messaging
order: 1
summary: The composer, delivery options, what "sent" means for each, the unified inbox, approvals, scheduling and logging.
updated: 2026-09-14
---

## The composer

Open a client (or a conversation in the inbox) and use the composer:

- **Write** your own text, or
- **Generate** an AI first message, then **Regenerate**, **Shorter**, **More professional**, **More friendly** or **Personalize** (adds details from the profile).
- **Attach** documents (catalogues, price lists) from Documents.
- Choose **Send myself** or **Send automatically**.

Every AI draft is checked against your facts before you see it. Violations (an invented MOQ, a certification you do not hold, a delivery promise) are shown and block automatic sending.

## Delivery options

| Option | What happens | Status tracking |
|---|---|---|
| **Send myself** | OSES J opens Instagram/Facebook with the text ready and records the message as *Sent · by you* | none |
| **Browser extension** | A paired Chrome extension opens the profile in your logged-in session, types and sends the message, and reports back | sent / failed / blocked |
| **Apify** | A messaging Actor sends the message (optional, use with care) | only if the Actor confirms |
| **Meta official API** | Replies to buyers who have already messaged your connected Page/Instagram account | delivered and seen |

**Send automatically** picks the best available option in this order: Meta (existing thread only) → extension (online and logged in) → Apify (configured) → otherwise it tells you why and offers *Send myself*. The decision, including every provider considered and the reason it was skipped, is stored on the message.

OSES J never claims a message was delivered when it cannot verify it.

## The unified inbox

**Inbox** lists every conversation across Instagram and Facebook with filters for channel, unread, AI status, client status, tags and search. Each conversation shows:

- messages with author (you, AI, system, client), timestamps and delivery states where available;
- AI summary, detected intent and confidence;
- pending approvals (Copilot drafts) with **Approve & send**, **Edit**, **Send myself**, **Reject**;
- scheduled messages with **Cancel**;
- needs-human flags with the reason (pricing, negotiation, complaint, unclear).

## Logging messages exchanged elsewhere

If you talk to a buyer directly in Instagram, use **Log message** (inbound or outbound) so the timeline stays complete. Logged inbound messages trigger the AI pipeline exactly like real ones.

## Scheduling

**Schedule** a message for a date and time in the buyer timezone (resolved from their location), your timezone, or a custom zone. Scheduled follow-ups are cancelled automatically when the buyer replies, opts out or is deleted.

## Rate limits and working hours

**Settings → Messaging** sets messages per hour and per day, minimum spacing, and working hours. Sends outside the window are moved to the next working slot in the buyer timezone. Limits apply to manual and automatic sends alike.

## Message statuses

`Draft`, `Pending approval`, `Queued`, `Sending`, `Sent`, `Delivered`, `Seen`, `Failed`, `Unavailable` (nothing could send it; use *Send myself*), `Cancelled`.
