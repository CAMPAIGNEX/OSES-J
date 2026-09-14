# Lead discovery

```
User query → Query parser → SearchCriteria → Orchestrator → Provider(s) → Raw items
   → Normalizer → Dedupe → Scoring → Persist (Lead / LeadSocialAccount / LeadContact) → Enrichment jobs
```

## Query parsing (`packages/discovery/src/query-parser.ts`)

Deterministic (no AI needed): extracts keywords, product categories (apparel, streetwear, sportswear, fitness, gym wear, hoodies, t-shirts, jerseys, tracksuits, hosiery, accessories) and a location from free text such as "New apparel brands in New York" (→ keyword `apparel`, city New York, country US). Explicit form fields always win. Hashtags are derived from keywords for the hashtag strategy.

## Providers and strategies

`DiscoveryProvider.search(criteria, ctx)` returns normalized-ish `DiscoveryResult`s plus provider run metadata. The Apify implementation wraps one Actor + one adapter each:

| Adapter | Actor (default) | Strategy | Notes |
|---|---|---|---|
| `search-engine-instagram` / `search-engine-facebook` | `apify/google-search-scraper` | `search_engine` | `site:instagram.com "keyword" "City"` queries; parses usernames and follower counts from snippets. Best for "brands in <city>". |
| `instagram-search` | `apify/instagram-scraper` | `profile_search` | Instagram user search with profile details. |
| `instagram-hashtag` | `apify/instagram-hashtag-scraper` | `hashtag` | Post authors become candidates; also used for content analysis. |
| `facebook-search` | (configure) | `profile_search` | Keyword page search — verify the Actor input schema. |
| `instagram-profile` | `apify/instagram-profile-scraper` | enrichment | Full profile details for known usernames. |
| `facebook-pages` | `apify/facebook-pages-scraper` | enrichment | Page details (about, contact, website). |
| `generic` | any | any | Operator-defined `inputTemplate` with `{{query}}`, `{{keywords}}`, `{{location}}`, `{{limit}}`, `{{hashtags}}`, `{{urls}}`, `{{usernames}}`. |

In `auto` strategy the orchestrator runs the search-engine strategy first when a location is present, then profile search, then hashtags, until the requested quota is reached. Provider configuration comes from `ProviderConfig` rows (organization > global) with environment defaults as the fallback.

## Normalization (`normalizer.ts`)

Only fields the provider actually returned are stored. Websites are classified (link aggregators such as linktr.ee are flagged), social links in bios become `socialLinks`, emails/phones/WhatsApp numbers found in bios become contacts with `source = INSTAGRAM_BIO` / `FACEBOOK_PAGE`, business contact fields become `source = PROFILE`. Location is stored only when the provider returned one — the search location is displayed as "(search)" in the UI, never written into the lead.

## Deduplication (`dedupe.ts`, `lead-repository.ts`)

1. In-batch: identity keys (`ig:user:<name>`, `fb:id:<id>`, `web:<domain>`, `email:<e>`, `phone:<p>`, linked social profiles) collapse duplicates; records are merged filling blanks and unioning contacts.
2. Against the database: `findExistingLead` checks the same keys (including `LeadSocialAccount` and `LeadContact` tables), then fuzzy brand matching (`fuzzyMatch`: Jaro-Winkler / Dice on brand keys + website/email-domain/location corroboration; ≥ 0.9 duplicate, 0.72–0.9 ambiguous).
3. Existing leads are updated (blanks filled, follower counts refreshed, `lastSeenAt`) and linked to the new `SearchRun` with `matchedExisting = true`.
4. `DuplicateResolver` is the hook for an AI resolver on ambiguous pairs (not required for the MVP).

## Scoring (`scoring.ts`)

0–100 with a stored breakdown: follower range fit, website, email, phone, WhatsApp, business account, verified, keyword relevance, stated location match, recent activity, provider rank; private accounts are penalized. Unknown values score 0 (never negative) so enrichment can only improve a lead.

## Persistence

`persistDiscoveredLeads` writes `Lead` (denormalized primary fields), `LeadSocialAccount` (raw payload + provider run reference), `LeadContact` (sourced contacts) and `SearchRunLead` (rank, match info). Leads missing followers/bio are queued for profile enrichment; leads with a real website but missing contacts are queued for website extraction (`ENRICHMENT_JOB`, batches of 25).

## Search history and saved searches

Every run is a `SearchRun` (criteria, status, stage, counts, provider summary, warnings). `SavedSearch` stores a criteria set to re-run with one click; runs reference the saved search and increment its run count.
