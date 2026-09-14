# Apify

Apify is the default external provider for discovery, profile enrichment and (optionally) DM automation. OSES J talks to the Apify REST API directly (`packages/apify`), no SDK, and nothing in the business logic knows Actor specifics; each Actor sits behind an adapter.

## Configuration

| Level | Where | Notes |
|---|---|---|
| Token | Settings > Automation (encrypted per organization) or `APIFY_API_TOKEN` | Organization token wins |
| Actors | Settings > Providers (`ProviderConfig` rows) or `APIFY_*_ACTOR` env defaults | Organization rows override global rows override env |
| Test | Settings > Providers > Test / Settings > Automation > Test token | Verifies the token (`/users/me`) and that the Actor exists |

Default Actors (public on the Apify Store; verify pricing and input schemas before production use):

| Purpose | Env | Default | Adapter |
|---|---|---|---|
| Search-engine discovery | `APIFY_SEARCH_ENGINE_ACTOR` | `apify/google-search-scraper` | `search-engine-instagram` / `search-engine-facebook` |
| Instagram search | `APIFY_INSTAGRAM_SEARCH_ACTOR` | `apify/instagram-scraper` | `instagram-search` |
| Instagram profiles | `APIFY_INSTAGRAM_PROFILE_ACTOR` | `apify/instagram-profile-scraper` | `instagram-profile` |
| Instagram hashtags | `APIFY_INSTAGRAM_HASHTAG_ACTOR` | `apify/instagram-hashtag-scraper` | `instagram-hashtag` |
| Facebook pages | `APIFY_FACEBOOK_PAGES_ACTOR` | `apify/facebook-pages-scraper` | `facebook-pages` |
| Facebook search | `APIFY_FACEBOOK_SEARCH_ACTOR` | (none) | `facebook-search` |
| Messaging | `APIFY_MESSAGING_ACTOR` | (none) | `generic-dm` |

## Adapters

An adapter maps `SearchCriteria` to Actor input and Actor dataset items to `DiscoveryResult`. Field access is lenient (`username` / `userName` / `ownerUsername`, `followersCount` / `followers_count` / `12.5K`), so Actor version drift usually needs no code change. For an Actor with a different input schema use the `generic` adapter with `settings.inputTemplate`, for example:

```json
{ "inputTemplate": { "search": "{{query}}", "searchType": "user", "resultsLimit": "{{limit}}" }, "inputOverrides": { "proxy": { "useApifyProxy": true } } }
```

Placeholders: `{{query}}`, `{{keywords}}`, `{{location}}`, `{{limit}}`, `{{hashtags}}`, `{{urls}}`, `{{usernames}}`; messaging adds `{{username}}`, `{{profileUrl}}`, `{{threadUrl}}`, `{{threadId}}`, `{{message}}`.

## Runs, costs and retries

Every Actor run is recorded as a `ProviderRun` (actor, input, external run id, dataset id, item count, cost in USD, status, error). The client waits for the run (`waitForFinish` up to 5 minutes, then polls), classifies HTTP errors (401/403 = `AUTHENTICATION`, 429 = `RATE_LIMIT`, 5xx/timeouts = `TEMPORARY`), and the orchestrator continues with other providers when one fails, surfacing warnings on the search run. Usage is metered (`APIFY_RUNS`, `APIFY_COST_USD`) for the dashboard.

## Messaging Actors

Sending DMs through Apify is optional and treated with caution: a run is only interpreted as *sent* when its output explicitly says so (`successRule: item_status`, default) or when the operator configured `run_succeeded`. Unconfirmed results become `REQUIRES_USER` with the platform link so the exporter can send manually.
