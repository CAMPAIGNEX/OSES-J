---
title: Troubleshooting & FAQ
section: Help
order: 1
summary: Common messages you may see and what to do about them.
updated: 2026-09-14
---

## "AI is not configured"

Add an AI provider and API key in **AI Assistant → Behaviour & limits**, or ask your administrator to set a platform default.

## Search completed with 0 results and a warning

- *Apify API token is not configured*: add it in **Settings → Automation**.
- *No discovery provider is configured for the requested platform*: configure an Actor in **Settings → Providers**.
- Otherwise broaden the query or remove filters.

## "Message cannot be sent automatically"

Open the message: the provider decision lists why each option was skipped (no Meta thread, extension offline or logged out, Apify not configured). Use **Send myself**; the text is ready to paste.

## Extension shows "Waiting for heartbeat"

Pair again from **Settings → Automation**; make sure the OSES J address is reachable from the browser and that the extension is enabled for the workspace.

## A buyer replied but nothing happened

Check the AI mode. In Manual mode the AI only classifies. In Copilot mode the draft waits under *Pending approval* in the inbox. In Autopilot mode look at **AI Assistant → Activity** for the decision (confidence too low, escalation rule, outside working hours, daily limit reached).

## "This workspace is suspended"

Contact CNEX AI support; the workspace was suspended by the platform team.

## Wrong timezone on scheduled messages

Scheduling uses the buyer timezone resolved from their location. If the location is unknown, set it on the client profile or choose *your timezone* when scheduling.

## Where is my deleted client?

**Trash** keeps items for 7 days. After that they are purged; the CID stays reserved.

## Need help?

Use the contact page or email the address in **Settings → Account → Support**.
