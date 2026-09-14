import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  extractEmails,
  extractWhatsAppNumbers,
  formatCid,
  hashPassword,
  isPrivateIp,
  isWithinWorkingHours,
  nextWorkingSlot,
  normalizeCountryCode,
  normalizePhone,
  parseCid,
  parseSocialUrl,
  resolveTimezone,
  verifyPassword,
  zonedTimeToUtc,
  assertPublicHttpUrl,
} from "@oses/shared";

describe("CID formatting", () => {
  it("formats and parses zero-padded client ids", () => {
    expect(formatCid(1)).toBe("CX-000001");
    expect(formatCid(124)).toBe("CX-000124");
    expect(formatCid(1234567)).toBe("CX-1234567");
    expect(parseCid("cx-000042")).toEqual({ prefix: "CX", sequence: 42 });
    expect(parseCid("nope")).toBeNull();
  });
});

describe("timezone resolution", () => {
  it("resolves cities, regions and countries without assuming Pakistan time", () => {
    expect(resolveTimezone({ city: "New York" }).timezone).toBe("America/New_York");
    expect(resolveTimezone({ country: "USA", city: "New York" })).toMatchObject({ timezone: "America/New_York", source: "city", countryCode: "US" });
    expect(resolveTimezone({ country: "United States", region: "California" })).toMatchObject({ timezone: "America/Los_Angeles", source: "region" });
    expect(resolveTimezone({ country: "Germany", city: "Berlin" }).timezone).toBe("Europe/Berlin");
    expect(resolveTimezone({ country: "UK" })).toMatchObject({ timezone: "Europe/London", source: "country", confidence: "medium" });
    expect(resolveTimezone({ country: "United States" })).toMatchObject({ timezone: "America/New_York", confidence: "low" });
    expect(resolveTimezone({})).toMatchObject({ timezone: "UTC", source: "default", confidence: "low" });
    expect(normalizeCountryCode("Türkiye".normalize("NFD").replace(/[̀-ͯ]/g, ""))).toBe("TR");
  });
  it("does not let a foreign city override an explicit country", () => {
    expect(resolveTimezone({ country: "Canada", city: "London" }).timezone).toBe("America/Toronto");
  });
});

describe("working hours", () => {
  const wh = { enabled: true, start: "10:00", end: "17:00", days: [1, 2, 3, 4, 5] };
  it("checks the window in the client's zone", () => {
    const monday14NY = zonedTimeToUtc({ year: 2026, month: 3, day: 16, hour: 14, minute: 0 }, "America/New_York");
    expect(isWithinWorkingHours(monday14NY, "America/New_York", wh)).toBe(true);
    expect(isWithinWorkingHours(monday14NY, "Asia/Karachi", wh)).toBe(false); // 23:00 in Karachi
  });
  it("moves a weekend send to Monday morning", () => {
    const saturday = zonedTimeToUtc({ year: 2026, month: 3, day: 14, hour: 12, minute: 0 }, "Europe/Berlin");
    const next = nextWorkingSlot(saturday, "Europe/Berlin", wh);
    expect(next.toISOString()).toBe(zonedTimeToUtc({ year: 2026, month: 3, day: 16, hour: 10, minute: 0 }, "Europe/Berlin").toISOString());
  });
  it("handles DST transitions when converting wall-clock time", () => {
    const beforeDst = zonedTimeToUtc({ year: 2026, month: 3, day: 7, hour: 9, minute: 0 }, "America/New_York");
    const afterDst = zonedTimeToUtc({ year: 2026, month: 3, day: 9, hour: 9, minute: 0 }, "America/New_York");
    expect(beforeDst.getUTCHours()).toBe(14);
    expect(afterDst.getUTCHours()).toBe(13);
  });
});

describe("crypto", () => {
  it("hashes and verifies passwords with scrypt", async () => {
    const hash = await hashPassword("DemoPass123!");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("DemoPass123!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
  it("encrypts secrets at rest with AES-GCM", () => {
    const key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const enc = encryptSecret("apify_api_secret_123", key);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain("apify_api_secret");
    expect(decryptSecret(enc, key)).toBe("apify_api_secret_123");
    expect(() => decryptSecret(enc, "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=")).toThrow();
  });
});

describe("contact and url normalization", () => {
  it("parses social profile urls", () => {
    expect(parseSocialUrl("https://www.instagram.com/urban.fitness/?hl=en")).toEqual({ platform: "INSTAGRAM", username: "urban.fitness", profileUrl: "https://www.instagram.com/urban.fitness/", externalId: null });
    expect(parseSocialUrl("https://instagram.com/p/abc123/")).toBeNull();
    expect(parseSocialUrl("https://www.facebook.com/profile.php?id=1234567")).toMatchObject({ platform: "FACEBOOK", externalId: "1234567" });
    expect(parseSocialUrl("https://m.facebook.com/UrbanFitnessWear")).toMatchObject({ platform: "FACEBOOK", username: "urbanfitnesswear" });
  });
  it("normalizes phones, whatsapp links and emails", () => {
    expect(normalizePhone("+1 (415) 555-1234")).toBe("+14155551234");
    expect(normalizePhone("0044 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("12345")).toBeNull();
    expect(extractWhatsAppNumbers("chat: https://wa.me/923001234567 now")).toEqual(["+923001234567"]);
    expect(extractEmails("Contact hello@brand.com or logo@2x.png")).toEqual(["hello@brand.com"]);
  });
});

describe("SSRF protection", () => {
  it("blocks private and loopback targets", async () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.2.3.4")).toBe(true);
    expect(isPrivateIp("172.16.9.9")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    await expect(assertPublicHttpUrl("http://localhost:3306/")).rejects.toMatchObject({ code: "BLOCKED_URL" });
    await expect(assertPublicHttpUrl("http://169.254.169.254/latest/meta-data")).rejects.toMatchObject({ code: "BLOCKED_URL" });
    await expect(assertPublicHttpUrl("ftp://example.com")).rejects.toMatchObject({ code: "INVALID_URL" });
  });
});
