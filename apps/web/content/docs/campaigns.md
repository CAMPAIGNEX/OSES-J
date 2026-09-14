---
title: Campaigns
section: Automation
order: 1
summary: Audiences, message strategy, follow-up ladders, limits, approvals and campaign controls.
updated: 2026-09-14
---

## Create a campaign

**Campaigns → New campaign**:

1. **Audience**: pick saved leads or clients by tag, status, platform or search run. Do-not-contact clients are excluded automatically.
2. **First message**: AI-generated (personalised per lead) or a template with placeholders such as `{brand}`. AI drafts are validated against your facts.
3. **Follow-up ladder**: days after the first message for each follow-up (for example 3 and 7). Follow-ups stop as soon as the buyer replies.
4. **Working hours** and **daily limit** for this campaign (never above the workspace limits).
5. **Approval gate**: require approval for every message, only for AI drafts, or none (Autopilot only).

## Running

**Start** enqueues the first batch; the campaign page shows queued, sent, replied, failed and skipped counts with reasons. **Pause** stops new sends without cancelling scheduled ones; **Stop** cancels everything pending.

## Delivery

Campaign messages use the same provider resolution as the composer (Meta for existing threads, extension, Apify, otherwise *requires user*). Messages that cannot be sent automatically appear in the inbox with an *Open in Instagram* link.

## Safety

- Workspace rate limits and working hours always apply.
- The emergency **Pause all automation** switch stops every campaign.
- Every send, skip and failure is recorded on the campaign and in the audit log.
