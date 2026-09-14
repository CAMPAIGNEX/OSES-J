---
title: Integrations (Apify, Meta)
section: Integrations
order: 1
summary: Configure Apify Actors for discovery and enrichment, and connect Facebook Pages and Instagram accounts through Meta.
updated: 2026-09-14
---

## Apify

Apify runs the "Actors" that search Instagram and Facebook and read profiles.

1. Create an Apify account and copy your API token.
2. **Settings → Automation → Apify token**: paste it and click **Test**. The token is stored encrypted.
3. **Settings → Providers** lists the Actors per purpose (search engine, Instagram search, Instagram profiles, hashtags, Facebook pages, messaging). Defaults are set; change them if you prefer other Actors. **Test** checks the Actor exists.
4. Each run is recorded with its cost in **Search history**. Set a maximum cost per run in **Settings → Automation** if needed.

If an Actor changes its input format, use the *Generic* adapter with an input template (see the technical documentation).

## Meta (Instagram and Facebook official API)

Connecting Meta lets OSES J receive messages sent to your Page or Instagram professional account, reply through the official API and see delivery/read receipts. Meta does not allow cold outreach through the API; first contact still uses the extension, Apify or manual sending.

1. **Settings → Social accounts → Connect Meta**. Sign in with the Facebook account that manages your Page.
2. Select the Pages and Instagram accounts to connect.
3. Connected accounts show *Connected*; if a token expires you see *Expired* with a **Reconnect** button.

Inbound messages create conversations (and clients if the sender is unknown) automatically and trigger the AI pipeline.

## Provider status

**Settings → Automation** shows the state of every provider (Apify token, AI provider, Meta connections, extension devices) so you know which delivery options are available before you send.
