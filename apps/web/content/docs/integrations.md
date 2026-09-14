---
title: Integrations (Apify, Meta)
section: Integrations
order: 1
summary: Configure Apify Actors for discovery and enrichment, and connect Facebook Pages and Instagram accounts through Meta.
updated: 2026-09-15
---

## Discovery and enrichment (managed for you)

Lead discovery and profile enrichment run through external data providers. The CNEX AI team configures and maintains them for your workspace from the platform control room; you never see or handle tokens, Actors or job limits. **Settings → Automation → Services** shows whether discovery is active. Each search run still shows its status, counts and warnings in **Search history**.

To request activation or a change, email info@cnexai.com or WhatsApp +92 312 7233047.

## Meta (Instagram and Facebook official API)

Connecting Meta lets OSES-J receive messages sent to your Page or Instagram professional account, reply through the official API and see delivery/read receipts. Meta does not allow cold outreach through the API; first contact still uses the extension, Apify or manual sending.

1. **Settings → Social accounts → Connect Meta**. Sign in with the Facebook account that manages your Page.
2. Select the Pages and Instagram accounts to connect.
3. Connected accounts show *Connected*; if a token expires you see *Expired* with a **Reconnect** button.

Inbound messages create conversations (and clients if the sender is unknown) automatically and trigger the AI pipeline.

## Service status

**Settings → Automation → Services** shows the state of everything that affects sending and searching: discovery, the AI agent, the browser extension and your Meta connections, so you know which delivery options are available before you send.
