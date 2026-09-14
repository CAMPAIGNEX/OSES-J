# Enrichment

Enrichment adds public business information to leads and clients while keeping the source of every field explicit.

## Profile enrichment

Leads discovered without follower counts or bios are enriched through the platform's `ProfileProvider` (Apify `instagram-profile` / `facebook-pages` adapters). One Actor run handles a batch of usernames; results are matched back by username / external id and applied with `applyProfileToLead` (fills blanks, refreshes volatile metrics, adds contacts, re-scores).

## Website extraction (`packages/enrichment/src/website-extractor.ts`)

For leads/clients with a real website (link aggregators are skipped):

1. Fetch the home page (public HTTP only — `assertPublicHttpUrl` resolves DNS and rejects private/loopback/link-local targets, redirects are re-checked, 1.5 MB cap, 12 s timeout, HTML only).
2. Find one contact/about/wholesale page on the same domain and fetch it too.
3. Extract, in order of confidence:
   - JSON-LD `Organization` / `LocalBusiness` blocks → email, telephone, address, `sameAs` social links (`VERIFIED`, label `structured-data`)
   - `mailto:` links (`VERIFIED` when the address is on the site's own domain), `tel:` links, `wa.me` links
   - visible page text → emails, WhatsApp numbers, up to two phone numbers (`PUBLIC`, label `page-text`)
   - `og:site_name`, title and description
4. Persist as `LeadContact` / `ClientContact` rows with `source = WEBSITE`, `sourceUrl` = the page it came from, then fill blank lead fields and re-score.

Placeholder emails (`example.com`, image names, `sentry.io`, …) are discarded; free-mail domains never count as a brand's own domain.

## Entity resolution

Website enrichment can reveal social links (a Facebook page listed on an Instagram brand's website). These are added as additional `LeadSocialAccount` rows and participate in future deduplication keys, so the same business found later on Facebook is matched to the existing lead.

## Timezone resolution

When a lead or client has a location, `resolveTimezone` maps city → region → country to an IANA zone with a stated confidence. Unknown locations stay unknown (`UTC` fallback marked `default`); the exporter's own zone is never assumed for a client.

## Status

Each lead carries `enrichmentStatus` (`NONE`, `PENDING`, `RUNNING`, `COMPLETED`, `PARTIAL`, `FAILED`) and `enrichmentError`, visible in the lead detail page. Client profiles offer "Enrich from website" and "Re-check eligibility" actions.
