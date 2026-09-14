---
title: AI assistant
section: AI assistant
order: 1
summary: Company facts, instructions, knowledge base, what the AI can and cannot do, rules, modes and the activity log.
updated: 2026-09-14
---

## What the AI does

- Analyses a lead (fit score, likely products, talking points, risks).
- Writes a personalised **first message**.
- **Classifies** replies: interested, not interested, price request, catalogue request, sample request, MOQ question, negotiation, objection, question, needs human, spam, opt-out.
- Drafts **replies** and **follow-ups**.
- **Summarises** conversations with a stage and next action.

Everything it writes comes from three sources you control: company facts, instructions and the knowledge base. It is told, and checked, never to invent prices, MOQs, certifications, capacity, delivery dates or existing relationships.

## Company facts (Settings → Company)

Products, MOQ, certifications, capacity, lead times, markets, payment terms, shipping, differentiators, contact details. These are formatted as verified facts in every prompt.

## Instructions (AI Assistant → Instructions)

Add instructions by kind: **Tone**, **Rules**, **Products**, **Pricing**, **Prohibited**, **Escalation**, **Templates**, **Knowledge**. Examples:

- Tone: "Short, warm, professional. British English."
- Prohibited: "Never say: cheapest in the market."
- Escalation: "Any pricing or sample request goes to a human."

## Knowledge base (AI Assistant → Knowledge)

Upload `.txt` documents (catalogue descriptions, FAQs, size charts, terms). They are split into chunks and retrieved by relevance when the AI needs details. Keep files factual; the AI quotes them.

## Business-rule validation

Every generated message is checked deterministically:

- prices and currency amounts must appear in your pricing facts;
- MOQ numbers must match your MOQ facts;
- delivery and lead-time promises must be backed by facts;
- certifications must be listed in your facts;
- no claims of an existing relationship ("as we discussed");
- no guarantees or superlatives;
- your prohibited phrases;
- no leftover placeholders.

Blocking violations prevent automatic sending and are shown in Copilot/Manual so you can fix them.

## Modes (Settings → Messaging)

| Mode | Behaviour |
|---|---|
| Manual | The AI classifies and suggests only when asked |
| Copilot | The AI drafts first messages, replies and follow-ups as *pending approval* |
| Autopilot | The AI sends within limits: per-kind toggles (first contact, replies, follow-ups), confidence threshold, escalation rules (pricing, negotiation, complaints, unusual), daily and hourly caps, working hours, do-not-contact and opt-out detection |

**Pause all automation** (Settings → Automation) stops campaigns and AI sends immediately.

## Activity log (AI Assistant → Activity)

Every AI action is logged with provider, model, tokens, duration, result, status and any rule violations. Autopilot decisions are logged as well, with the reason the AI acted or held back.

## Providers

Choose Anthropic, OpenAI or any OpenAI-compatible endpoint in **AI Assistant → Behaviour & limits**; keys are stored encrypted. If none is configured, AI buttons return "AI is not configured" and the rest of the product keeps working.
