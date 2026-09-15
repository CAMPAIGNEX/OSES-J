# AI sales agent

## Providers

`AIProvider.generate({ system, messages, jsonSchema?, maxTokens?, temperature? })` returns text + parsed JSON + usage. Implementations:

- `AnthropicProvider`: official `@anthropic-ai/sdk`, default model `claude-opus-5`; JSON output through a forced tool call with the requested schema.
- `OpenAICompatibleProvider`: `POST /chat/completions` for OpenAI or any compatible endpoint (`json_schema` response format when supported, JSON mode otherwise).

Resolution order: workspace override (OS-Panel → Organization → Operations, key encrypted) > platform provider (OS-Panel → Providers & keys, key encrypted) > environment (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`) > none. Members never configure providers; they only choose tone and language. When no provider is available every AI action returns a clear `NOT_CONFIGURED` error and the rest of the product keeps working.

## Context building (`packages/ai/src/context.ts`)

Each prompt is assembled from **verified data only**:

1. Organization facts: company profile (products, MOQ, capacity, certifications, markets, lead times, payment terms, shipping, differentiators), formatted as `Key: value` lines.
2. Active `AIInstruction` rows by kind (`TONE`, `RULES`, `PRODUCTS`, `PRICING`, `PROHIBITED`, `ESCALATION`, `TEMPLATE`, `KNOWLEDGE`).
3. Knowledge retrieval: top chunks from uploaded TXT documents (MySQL full-text `MATCH ... AGAINST` with a keyword fallback; the embeddings path is wired for an `EmbeddingProvider` but not required).
4. Client context: brand, category, bio, followers, location/timezone, contact sources, tags, notes, last activity, recent conversation.
5. Non-negotiable rules: never invent prices, MOQ, certifications, capacity, delivery dates or relationships; ask instead of guessing; respect prohibited claims; write for the target platform.

## Actions (`packages/ai/src/agent.ts`)

| Action | Output |
|---|---|
| `analyzeLead` | fit score, likely products, talking points, risks, suggested channel |
| `generateFirstMessage` | personalized opener (variants: shorter, more professional, more friendly, personalize) |
| `classifyIntent` | `INTERESTED`, `NOT_INTERESTED`, `PRICE_REQUEST`, `CATALOG_REQUEST`, `SAMPLE_REQUEST`, `MOQ_QUESTION`, `NEGOTIATION`, `OBJECTION`, `QUESTION`, `NEEDS_HUMAN`, `SPAM`, `OPT_OUT`, `UNKNOWN` + confidence + summary |
| `generateReply` | context-aware reply with open questions the AI could not answer from facts |
| `generateFollowUp` | polite follow-up when no reply after N days |
| `summarizeConversation` | stage + next action |

Every action writes an `AIActionLog` (provider, model, tokens, duration, prompt fingerprint, result, status, validation violations) visible in **AI Assistant > Activity**.

## Business-rule validation (`rules.ts`)

Deterministic checks run on every generated message: prices/currency amounts, MOQ numbers, delivery promises, certifications, relationship claims, guarantees/superlatives, organization prohibited phrases, leftover placeholders and length. Numbers are only accepted when they appear on fact lines about the same topic (a certification number cannot vouch for an MOQ). Blocking violations prevent sending in autopilot and are shown to the user in copilot/manual mode.

## Modes and controls (`packages/automation/src/autopilot.ts`)

| Mode | Behaviour |
|---|---|
| `MANUAL` | AI only classifies and suggests when asked |
| `COPILOT` | AI drafts replies/follow-ups as `PENDING_APPROVAL`; the user approves, edits, sends manually or rejects |
| `AUTOPILOT` | AI sends within limits: per-kind toggles (first contact, replies, follow-ups), confidence threshold, escalation rules (pricing, negotiation, complaints, unusual), daily/hourly limits, working hours in the client zone, do-not-contact, opt-out detection |

Autopilot decisions are logged as `AUTOPILOT_DECISION`; the emergency **Pause all automation** switch (Settings > Automation) stops campaigns and AI sends immediately.

## Content analysis

Competitor and trend analysis fetch public posts through the content provider, aggregate observed metrics (post counts, hashtags, engagement) and ask the AI for an interpretation. The UI separates **Observed data** from **AI interpretation**; nothing in the analysis feeds the sales rules automatically.
