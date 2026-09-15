import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSearchCriteria, GoogleCseDiscoveryProvider } from "@oses/discovery";

describe("Google Custom Search discovery provider", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("turns Custom Search results into Instagram leads and records a free provider run", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      calls.push(url.searchParams.get("q") ?? "");
      expect(url.searchParams.get("key")).toBe("k");
      expect(url.searchParams.get("cx")).toBe("cx");
      return new Response(
        JSON.stringify({
          items: [
            { link: "https://www.instagram.com/urbanfitnesswear/", title: "Urban Fitness Wear (@urbanfitnesswear) • Instagram photos and videos", snippet: "12K Followers, 300 Following, 450 Posts - Performance apparel made in NYC" },
            { link: "https://www.instagram.com/p/abc123/", title: "Photo by Endia (@endia698) · August 30, 2026", snippet: "gym fit" },
            { link: "https://www.facebook.com/somepage", title: "Some page | Facebook", snippet: "" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    const provider = new GoogleCseDiscoveryProvider({ apiKey: "k", cseId: "cx" }, "INSTAGRAM");
    const criteria = buildSearchCriteria({ query: "gym accessories brands in New York", keywords: [], platform: "INSTAGRAM", limit: 10, strategy: "search_engine", filters: {}, enrich: false });
    expect(provider.supports(criteria)).toBe(true);
    const runs: unknown[] = [];
    const batch = await provider.search(criteria, { organizationId: "org", onProviderRun: (r) => void runs.push(r) });
    expect(calls.length).toBe(2);
    expect(calls[0]).toContain('site:instagram.com intitle:"Instagram photos and videos" "gym accessories" "New York"');
    expect(batch.results.map((r) => r.username)).toEqual(["urbanfitnesswear", "endia698"]);
    expect(batch.results[0]).toMatchObject({ followers: 12000, displayName: "Urban Fitness Wear" });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ provider: "google", actorId: "customsearch/v1", status: "SUCCEEDED", costUsd: 0, itemCount: 6 });
    expect(batch.warnings).toEqual([]);
  });

  it("reports a failed run with the Google error instead of throwing", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { code: 403, message: "API key not valid" } }), { status: 403 })) as typeof fetch;
    const provider = new GoogleCseDiscoveryProvider({ apiKey: "bad", cseId: "cx" }, "INSTAGRAM");
    const criteria = buildSearchCriteria({ query: "streetwear brands Berlin", keywords: [], platform: "INSTAGRAM", limit: 5, strategy: "auto", filters: {}, enrich: false });
    const batch = await provider.search(criteria, { organizationId: "org" });
    expect(batch.results).toEqual([]);
    expect(batch.runs[0]).toMatchObject({ status: "FAILED", itemCount: 0 });
    expect(batch.warnings[0]).toContain("API key not valid");
  });
});
