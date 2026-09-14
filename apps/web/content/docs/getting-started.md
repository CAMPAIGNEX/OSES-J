---
title: Getting started
section: Getting started
order: 1
summary: Create your workspace, add your company facts and run the first search in ten minutes.
updated: 2026-09-14
---

## What OSES J does

OSES J is an export sales desk for apparel, sportswear, hosiery and fitness-wear manufacturers. It finds potential buyers (brands and shops) on Instagram and Facebook, enriches their public business details, organises them as leads and clients, and lets you contact and follow up with them, manually or with an AI sales agent that follows your rules.

The workflow is always the same:

1. **Find** leads with a search.
2. **Save** the ones that fit.
3. **Add to business** to create a client with a permanent ID.
4. **AI contact** with a first message.
5. **Follow up** from the unified inbox.
6. **Close** and track performance.

## Create a workspace

1. Open **Create account** and enter your name, email, password and company name. The company becomes your *workspace* (organisation). Everything you do is private to that workspace.
2. Sign in. You land on the **Dashboard**.
3. Invite colleagues later from **Settings → Account** (roles: Owner, Admin, Member).

## Add your company facts (5 minutes, do this first)

The AI only ever uses facts you provide. Go to **Settings → Company** and fill in:

- Products and categories you manufacture
- Minimum order quantity (MOQ)
- Certifications (only the ones you actually hold)
- Production capacity and lead times
- Markets you export to, shipping and payment terms
- Website, contact email and phone

Then open **AI Assistant → Instructions** and add tone, rules and anything the AI must never say (for example "never quote prices in the first message").

## Connect providers

- **Apify** (for discovery and enrichment): paste your token in **Settings → Automation**. Without it, searches complete with a warning and no results.
- **AI**: add an API key in **AI Assistant → Behaviour & limits** (Anthropic, OpenAI or any OpenAI-compatible endpoint). Without it, AI buttons return a clear "AI is not configured" message and everything else keeps working.
- **Meta** (optional): connect Facebook Pages and Instagram professional accounts in **Settings → Social accounts** to receive and answer messages through the official API.
- **Browser extension** (optional): lets OSES J send approved messages from your own logged-in Instagram/Facebook session. See *Browser extension*.

## Run your first search

1. Open **Search Leads**.
2. Type a description such as `New apparel brands in New York` or `gym wear brands in Manchester, UK`.
3. Optionally set platform, follower range, location and category.
4. Click **Search**. The run shows its progress (discovering, normalising, enriching) and the results appear with a score.
5. Tick the leads you like and click **Save**.

## Add to business and contact

1. Open **Saved Leads**, select the leads and click **Add to Business**. Each becomes a client with a CID such as `CX-000001`.
2. Open the client and click **AI first message** (or write your own).
3. Choose **Send myself** (opens Instagram or Facebook with the text ready) or **Send automatically** (extension, Apify or Meta, whichever is available).

## Choose an AI mode

**Settings → Messaging → Mode**:

- **Manual**: the AI only suggests.
- **Copilot**: the AI drafts replies and follow-ups; you approve each one in the inbox.
- **Autopilot**: the AI sends within the limits you set.

Start with Copilot. Switch to Autopilot once the drafts consistently look right.

## Next steps

- *Finding leads* explains queries, filters, strategies, scores and sources.
- *Clients & CRM* explains CIDs, duplicates, tags and the timeline.
- *Messaging & inbox* explains delivery options and what "sent" means for each.
- *AI assistant* explains facts, instructions, knowledge, rules and modes.
