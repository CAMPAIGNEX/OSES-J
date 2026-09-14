---
title: Finding leads
section: Finding leads
order: 1
summary: Search queries, filters, strategies, scores, enrichment and the sources behind every field.
updated: 2026-09-14
---

## Writing a search

Open **Search Leads** and describe the buyer in plain language. The parser understands:

- **Product categories**: apparel, streetwear, sportswear, fitness, gym wear, hoodies, t-shirts, jerseys, tracksuits, hosiery, accessories and more.
- **Locations**: cities, regions and countries in many spellings (`New York`, `NYC`, `Manchester, UK`, `Germany`).
- **Recency hints**: words like `new` or `emerging` raise the weight of recently active accounts.

Examples:

- `New apparel brands in New York`
- `streetwear brands Berlin`
- `gym wear brands based in Manchester, UK`

Explicit fields always win over the parsed text. If you set *City = Lyon* and the query says *Paris*, the search uses Lyon.

## Filters

| Filter | Effect |
|---|---|
| Platform | Instagram, Facebook or both |
| Followers | Minimum and maximum; unknown counts are kept until enrichment fills them in |
| Location | Country, region, city |
| Category | Narrows keywords and hashtags |
| Has email / website / phone | Hard filters applied only when the value is known |
| Limit | Number of leads you want (per platform) |
| Strategy | *Auto* (recommended), *Search engine*, *Profile search*, *Hashtags* |
| Enrich | Run profile and website enrichment after the search |

## Strategies

- **Search engine**: Google results restricted to instagram.com or facebook.com with your keywords and location. Best for "brands in a city".
- **Profile search**: the platform search Actor with your keywords.
- **Hashtags**: authors of recent posts under hashtags derived from your keywords.
- **Auto**: runs the search-engine strategy first when a location is present, then profile search, then hashtags, until your limit is reached.

Each strategy needs an Apify Actor. Defaults are configured; you can change them in **Settings → Providers**.

## Understanding a result

Every lead shows:

- **Score (0-100)** with a breakdown: follower range fit, website, email, phone, WhatsApp, business account, verified badge, keyword relevance, location match, recent activity and provider rank. Private accounts are penalised. Unknown values score zero, never negative.
- **Contacts with sources**: `PROFILE`, `INSTAGRAM_BIO`, `FACEBOOK_PAGE`, `WEBSITE`, `SEARCH_ENGINE`, `MANUAL`, plus a confidence (`VERIFIED`, `PUBLIC`, `INFERRED`).
- **Location**: only if the provider returned one. The search location is displayed as "(search)" and never written into the lead.
- **Match info**: whether the lead already existed from a previous search.

## Duplicates

Within a search, the same account found twice is merged. Across searches, an existing lead is matched by handle, platform id, website domain, email or phone, then by fuzzy brand-name matching with corroborating signals. Matched leads are updated (blanks filled, follower counts refreshed) and linked to the new search, never duplicated.

## Enrichment

After a search, leads missing followers or a bio are sent to profile enrichment; leads with a real website (link aggregators such as linktr.ee are skipped) but no contacts are sent to website extraction. Website extraction reads the home page and one contact/about page: structured data, `mailto:` and `tel:` links, WhatsApp links and visible text. Each extracted contact carries the page it came from.

You can re-run enrichment from a lead or client profile at any time.

## Search history and saved searches

- **History** lists every run with status, counts, warnings and cost.
- **Saved searches** store a criteria set; **Run again** repeats it. Runs referencing a saved search increment its counter.

## Bulk actions on results

Select leads and use **Save**, **Add to Business**, **Tag**, **Export** (XLSX) or **Delete** (moves to Trash).

## When a search returns nothing

- *Apify token not configured*: add it in **Settings → Automation**.
- *No provider for the platform*: configure an Actor in **Settings → Providers**.
- *Provider failed*: the run shows the provider error; other providers continue.
- Try a broader query, remove the follower range, or switch strategy.
