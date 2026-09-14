import { describe, expect, it } from "vitest";
import {
  applyCriteriaFilters,
  buildSearchCriteria,
  buildSearchEngineQueries,
  dedupeBatch,
  DiscoveryOrchestrator,
  fuzzyMatch,
  identityKeys,
  normalizeDiscoveryResult,
  normalizeInstagramProfile,
  normalizeSearchEngineItems,
  parseQuery,
  scoreLead,
  type DiscoveryProvider,
  type DiscoveryResult,
  type DiscoverySource,
} from "@oses/discovery";

const source: DiscoverySource = { provider: "apify", actorId: "apify/instagram-scraper", adapter: "instagram-search", fetchedAt: new Date("2026-09-01T00:00:00Z") };

function result(partial: Partial<DiscoveryResult> & { username: string }): DiscoveryResult {
  return { platform: "INSTAGRAM", profileUrl: `https://www.instagram.com/${partial.username}/`, raw: {}, source, ...partial };
}

describe("query parser", () => {
  it('parses "New apparel brands in New York"', () => {
    const parsed = parseQuery("New apparel brands in New York");
    expect(parsed.keywords).toContain("apparel");
    expect(parsed.categories).toContain("apparel");
    expect(parsed.location).toMatchObject({ city: "New York", countryCode: "US" });
    expect(parsed.recencyHint).toBe(true);
  });
  it("parses multi-word categories and countries", () => {
    const parsed = parseQuery("gym wear brands based in Manchester, UK");
    expect(parsed.keywords[0]).toBe("gym wear");
    expect(parsed.location).toMatchObject({ city: "Manchester", countryCode: "GB" });
    expect(parseQuery("streetwear brands Berlin").location.city).toBe("Berlin");
  });
  it("lets explicit form fields override parsed values", () => {
    const criteria = buildSearchCriteria({ query: "hoodie brands in Paris", keywords: [], platform: "BOTH", city: "Lyon", country: "France", limit: 20, strategy: "auto", filters: {}, enrich: true, minFollowers: 5000, maxFollowers: 100000 });
    expect(criteria.platforms).toEqual(["INSTAGRAM", "FACEBOOK"]);
    expect(criteria.location).toMatchObject({ city: "Lyon", countryCode: "FR" });
    expect(criteria.hashtags).toContain("hoodie");
    expect(criteria.minFollowers).toBe(5000);
  });
});

describe("normalization", () => {
  it("labels contacts with their source and never invents location", () => {
    const lead = normalizeDiscoveryResult(result({ username: "urbanfit", displayName: "Urban Fit", bio: "Activewear for runners. hello@urbanfit.com / WhatsApp https://wa.me/14155551234", website: "https://linktr.ee/urbanfit", followers: 12000, email: "sales@urbanfit.com", isBusiness: true }));
    expect(lead.brandName).toBe("Urban Fit");
    expect(lead.dedupeKey).toBe("ig:urbanfit");
    expect(lead.websiteIsAggregator).toBe(true);
    expect(lead.email).toBe("sales@urbanfit.com");
    expect(lead.whatsapp).toBe("+14155551234");
    expect(lead.city).toBeNull();
    const emailContacts = lead.contacts.filter((c) => c.type === "EMAIL").map((c) => [c.normalizedValue, c.source, c.confidence]);
    expect(emailContacts).toEqual([
      ["sales@urbanfit.com", "PROFILE", "PUBLIC"],
      ["hello@urbanfit.com", "INSTAGRAM_BIO", "PUBLIC"],
    ]);
    expect(lead.inboxUrl).toBe("https://www.instagram.com/direct/new/");
  });
  it("keeps a facebook link from a bio as a social link, not a website", () => {
    const lead = normalizeDiscoveryResult(result({ username: "brandx", bio: "fb: https://facebook.com/brandxofficial site: https://brandx.com" }));
    expect(lead.websiteDomain).toBe("brandx.com");
    expect(lead.socialLinks).toEqual([{ platform: "FACEBOOK", username: "brandxofficial", profileUrl: "https://www.facebook.com/brandxofficial", externalId: null }]);
  });
  it("reads lenient field names from instagram actor items", () => {
    const r = normalizeInstagramProfile({ username: "Some.Brand", full_name: "Some Brand", followers_count: "12.5K", biography: "Streetwear", externalUrl: "https://somebrand.com", is_business_account: true }, { source });
    expect(r).toMatchObject({ username: "some.brand", displayName: "Some Brand", followers: 12500, isBusiness: true, website: "https://somebrand.com" });
  });
});

describe("search engine adapter", () => {
  it("builds site-restricted queries with location", () => {
    const criteria = buildSearchCriteria({ query: "apparel brands in New York", keywords: [], platform: "INSTAGRAM", limit: 10, strategy: "search_engine", filters: {}, enrich: false });
    const queries = buildSearchEngineQueries(criteria, "INSTAGRAM");
    expect(queries[0]).toContain("site:instagram.com");
    expect(queries[0]).toContain('"apparel"');
    expect(queries[0]).toContain('"New York"');
  });
  it("extracts usernames and follower counts from result snippets", () => {
    const items = normalizeSearchEngineItems(
      [{ organicResults: [{ title: "Urban Fitness Wear (@urbanfitnesswear) • Instagram photos and videos", url: "https://www.instagram.com/urbanfitnesswear/", description: "12K Followers, 300 Following, 450 Posts - Performance apparel made in NYC", position: 1 }, { title: "Reel", url: "https://www.instagram.com/reel/abc/", description: "", position: 2 }] }],
      "INSTAGRAM",
      source,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ username: "urbanfitnesswear", displayName: "Urban Fitness Wear", followers: 12000 });
  });
});

describe("deduplication", () => {
  it("merges the same account discovered twice and different platforms sharing a website", () => {
    const a = normalizeDiscoveryResult(result({ username: "urbanfit", followers: 1000 }));
    const b = normalizeDiscoveryResult(result({ username: "urbanfit", bio: "with bio", email: "x@urbanfit.com" }));
    const c = normalizeDiscoveryResult({ ...result({ username: "urbanfitpage" }), platform: "FACEBOOK", profileUrl: "https://www.facebook.com/urbanfitpage", website: "https://urbanfit.com" });
    const d = normalizeDiscoveryResult(result({ username: "other", website: "https://urbanfit.com" }));
    const { leads, merged } = dedupeBatch([a, b, c, d]);
    expect(merged).toBe(2);
    expect(leads).toHaveLength(2);
    expect(leads[0]).toMatchObject({ username: "urbanfit", followers: 1000, bio: "with bio", email: "x@urbanfit.com" });
    expect(identityKeys(leads[1]!)).toContain("web:urbanfit.com");
  });
  it("scores fuzzy matches conservatively", () => {
    expect(fuzzyMatch({ brandName: "Urban Fitness Wear", websiteDomain: "urbanfitness.com" }, { brandName: "Urban Fitness Wear Official", websiteDomain: "urbanfitness.com" }).verdict).toBe("duplicate");
    expect(fuzzyMatch({ brandName: "Urban Fitness Wear" }, { brandName: "Urban Outfitters" }).verdict).toBe("different");
    expect(fuzzyMatch({ brandName: "Nova Athletics", city: "London" }, { brandName: "Nova Athletic", city: "Berlin" }).verdict).not.toBe("duplicate");
  });
});

describe("scoring and filters", () => {
  it("rewards contactability and range fit, penalizes private accounts", () => {
    const good = normalizeDiscoveryResult(result({ username: "a", followers: 20000, website: "https://a.com", email: "hi@a.com", isBusiness: true, bio: "streetwear brand" }));
    const weak = normalizeDiscoveryResult(result({ username: "b", isPrivate: true }));
    const criteria = buildSearchCriteria({ query: "streetwear", keywords: [], platform: "INSTAGRAM", limit: 10, strategy: "auto", filters: {}, enrich: false, minFollowers: 5000, maxFollowers: 100000 });
    expect(scoreLead(good, criteria).total).toBeGreaterThan(60);
    expect(scoreLead(weak, criteria).total).toBeLessThan(15);
    expect(scoreLead(weak, criteria).notes).toContain("private account");
  });
  it("applies hard filters only when data is known", () => {
    const criteria = buildSearchCriteria({ query: "hoodies", keywords: [], platform: "INSTAGRAM", limit: 10, strategy: "auto", filters: { hasEmail: true }, enrich: false, minFollowers: 5000 });
    const withEmail = normalizeDiscoveryResult(result({ username: "a", followers: 9000, email: "a@a.com" }));
    const unknownFollowers = normalizeDiscoveryResult(result({ username: "b", email: "b@b.com" }));
    const tooSmall = normalizeDiscoveryResult(result({ username: "c", followers: 100, email: "c@c.com" }));
    const noEmail = normalizeDiscoveryResult(result({ username: "d", followers: 9000 }));
    expect(applyCriteriaFilters([withEmail, unknownFollowers, tooSmall, noEmail], criteria).map((l) => l.username)).toEqual(["a", "b"]);
  });
});

describe("orchestrator", () => {
  it("prefers the search-engine strategy when a location is present and reports warnings", async () => {
    const calls: string[] = [];
    const make = (key: string, strategy: "search_engine" | "profile_search", results: DiscoveryResult[]): DiscoveryProvider => ({
      key,
      platform: "INSTAGRAM",
      strategy,
      priority: 1,
      supports: () => true,
      search: async () => {
        calls.push(key);
        return { results, runs: [], warnings: key === "profile" ? ["profile provider warning"] : [] };
      },
    });
    const orchestrator = new DiscoveryOrchestrator([make("profile", "profile_search", [result({ username: "x" })]), make("search", "search_engine", [result({ username: "y" }), result({ username: "x" })])]);
    const criteria = buildSearchCriteria({ query: "apparel in New York", keywords: [], platform: "INSTAGRAM", limit: 1, strategy: "auto", filters: {}, enrich: false });
    const out = await orchestrator.run(criteria, { organizationId: "org" });
    expect(calls[0]).toBe("search");
    expect(out.totals.raw).toBe(2);
    expect(out.leads.map((l) => l.username)).toEqual(["y", "x"]);
  });
});
