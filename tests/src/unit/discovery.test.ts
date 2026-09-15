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
  instagramSearchAdapter,
  describeExclusions,
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
  it("keeps adjacent words as one phrase and reads a trailing 'City, CC'", () => {
    // Real production query that produced "gym" + "acessories" as separate keywords before.
    const parsed = parseQuery("New Gym Acessories Brands in New York");
    expect(parsed.keywords).toEqual(["gym acessories"]);
    expect(parsed.location).toMatchObject({ city: "New York", countryCode: "US" });
    const tail = parseQuery("fitness apparel wholesale buyers Manchester, UK");
    expect(tail.location).toMatchObject({ city: "Manchester", countryCode: "GB" });
    expect(tail.keywords).toEqual(["fitness apparel", "wholesale buyers"]);
  });
  it("understands any spelling of a city: newyork, NewYork, NYC, new york city", () => {
    for (const q of ["gym accessories brands in newyork", "gym accessories brands in NewYork", "gym accessories brands in NYC", "gym accessories brands in new york city"]) {
      expect(parseQuery(q).location, q).toMatchObject({ city: "New York", countryCode: "US" });
    }
    const criteria = buildSearchCriteria({ query: "gym accessories brands", keywords: [], platform: "INSTAGRAM", city: "NewYork", country: "United States", limit: 10, strategy: "auto", filters: {}, enrich: false });
    expect(criteria.location.city).toBe("New York");
    expect(buildSearchCriteria({ query: "brands", keywords: [], platform: "INSTAGRAM", city: "Sialkot", limit: 10, strategy: "auto", filters: {}, enrich: false }).location.city).toBe("Sialkot");
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
  it("pins profile-page titles and quotes only the most specific place", () => {
    const criteria = buildSearchCriteria({ query: "New Gym Acessories Brands in New York", keywords: [], platform: "INSTAGRAM", limit: 10, strategy: "search_engine", filters: {}, enrich: false });
    const queries = buildSearchEngineQueries(criteria, "INSTAGRAM");
    expect(queries[0]).toBe('site:instagram.com intitle:"Instagram photos and videos" "gym acessories" "New York"');
    expect(queries.join(" ")).not.toContain("United States");
    expect(queries.join(" ")).not.toContain('"US"');
    expect(instagramSearchAdapter.buildDiscoveryInput!(criteria, {})).toMatchObject({ search: "gym acessories", searchType: "user" });
  });
  it("turns post and reel hits into their authors, ignoring plain mentions", () => {
    // Snippets copied from a real google-search-scraper run.
    const items = normalizeSearchEngineItems(
      [
        {
          organicResults: [
            { url: "https://www.instagram.com/p/Dcpd2EVRTFR/", title: "Photo by Endia (@endia698) · August 30, 2026", description: "Market me new bracelets bhi aye haj ... New York, New York. 221 likes.", position: 1 },
            { url: "https://www.instagram.com/p/CrbSrMDO0ZC/", title: "The struggle to get the sports bra off after this shoulder ...", description: "#fit #gym #fyp · View all 57 comments · August 27 · lena_j83's profile picture. lena_j83. •. Follow · New York City", position: 2 },
            { url: "https://www.instagram.com/p/DYV8tYis5gI/", title: "My top 10 @sephora favorites @yslbeauty blush ...", description: "THE HAIR, MAKEUP, NAILS ... GRWM day one in New York", position: 3 },
            { url: "https://www.instagram.com/reel/DUgMRx7DCaw/", title: "Upper with mini me  #gym #bodybuilding", description: "", position: 4 },
          ],
        },
      ],
      "INSTAGRAM",
      source,
    );
    expect(items.map((i) => i.username)).toEqual(["endia698", "lena_j83"]);
    expect(items[0]!.providerScore).toBeLessThan(0.5);
    expect(items[0]!.followers).toBeNull();
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
  it("explains what the filters removed instead of returning a silent empty page", () => {
    const criteria = buildSearchCriteria({ query: "gym accessories brands in New York", keywords: [], platform: "INSTAGRAM", limit: 10, strategy: "auto", filters: {}, enrich: false, minFollowers: 500, maxFollowers: 5000 });
    const leads = [
      normalizeDiscoveryResult({ platform: "INSTAGRAM", username: "usarmy", profileUrl: "https://www.instagram.com/usarmy/", externalId: null, followers: 3_084_843, providerScore: 1, raw: {}, source }),
      normalizeDiscoveryResult({ platform: "INSTAGRAM", username: "justenergy_us", profileUrl: "https://www.instagram.com/justenergy_us/", externalId: null, followers: 55, providerScore: 1, raw: {}, source }),
      normalizeDiscoveryResult({ platform: "INSTAGRAM", username: "thechausa", profileUrl: "https://www.instagram.com/thechausa/", externalId: null, followers: 1667, providerScore: 1, raw: {}, source }),
    ];
    expect(applyCriteriaFilters(leads, criteria).map((l) => l.username)).toEqual(["thechausa"]);
    const text = describeExclusions(leads, criteria);
    expect(text).toContain("2 of 3 accounts found were excluded");
    expect(text).toContain("1 more followers than your maximum");
    expect(text).toContain("1 fewer followers than your minimum");
    expect(text).toContain("500–5,000");
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
