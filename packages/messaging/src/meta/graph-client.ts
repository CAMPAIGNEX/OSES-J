import { createHmac, timingSafeEqual } from "node:crypto";
import { fetchWithTimeout, getEnv, ProviderError, type ErrorClass } from "@oses/shared";

/**
 * Minimal Meta Graph API client for the official Facebook Page / Instagram messaging integration.
 * Only the endpoints OSES-J uses are wrapped. Tokens are passed explicitly; nothing is cached here.
 */

export interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string; name?: string } | null;
}

export interface MetaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export const META_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_messages",
];

export function graphBase(): string {
  return `https://graph.facebook.com/${getEnv().META_GRAPH_VERSION}`;
}

function classify(status: number, code?: number): ErrorClass {
  if (status === 401 || code === 190) return "AUTHENTICATION";
  if (status === 429 || code === 4 || code === 17 || code === 32 || code === 613) return "RATE_LIMIT";
  if (status >= 500) return "TEMPORARY";
  if (code === 10 || code === 200 || code === 551) return "TARGET_UNAVAILABLE";
  return "PERMANENT";
}

export async function graphRequest<T>(path: string, options: { method?: "GET" | "POST" | "DELETE"; token?: string; query?: Record<string, string | undefined>; body?: unknown }): Promise<T> {
  const url = new URL(`${graphBase()}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(options.query ?? {})) if (v !== undefined) url.searchParams.set(k, v);
  if (options.token) url.searchParams.set("access_token", options.token);
  let res: Response;
  try {
    res = await fetchWithTimeout(url.toString(), {
      method: options.method ?? "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      timeoutMs: 20_000,
    });
  } catch (err) {
    throw new ProviderError("meta", `Could not reach Meta Graph API: ${(err as Error).message}`, { errorClass: "TEMPORARY", cause: err });
  }
  const json = (await res.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new ProviderError("meta", `Meta API error${e.code ? ` (${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""})` : ""}: ${e.message ?? res.statusText}`, {
      errorClass: classify(res.status, e.code),
      details: { code: e.code, subcode: e.error_subcode, type: e.type, fbtrace: e.fbtrace_id },
    });
  }
  return json;
}

/** Meta app credentials, resolved by callers from the platform configuration (OS-Panel, env fallback). */
export interface MetaAppCredentials {
  appId: string | null;
  appSecret: string | null;
}

function requireMetaApp(creds: MetaAppCredentials): { appId: string; appSecret: string } {
  if (!creds.appId || !creds.appSecret) throw new ProviderError("meta", "The Meta app is not configured. The CNEX AI team sets it up in the OS-Panel (Providers & keys).", { code: "META_NOT_CONFIGURED", status: 503, errorClass: "USER_ACTION_REQUIRED" });
  return { appId: creds.appId, appSecret: creds.appSecret };
}

export function buildOAuthUrl(creds: MetaAppCredentials, redirectUri: string, state: string): string {
  const env = getEnv();
  const { appId } = requireMetaApp(creds);
  const url = new URL(`https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export async function exchangeCodeForToken(creds: MetaAppCredentials, code: string, redirectUri: string): Promise<MetaTokenResponse> {
  const { appId, appSecret } = requireMetaApp(creds);
  return graphRequest<MetaTokenResponse>("/oauth/access_token", { query: { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code } });
}

export async function exchangeForLongLivedToken(creds: MetaAppCredentials, shortLivedToken: string): Promise<MetaTokenResponse> {
  const { appId, appSecret } = requireMetaApp(creds);
  return graphRequest<MetaTokenResponse>("/oauth/access_token", {
    query: { grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: shortLivedToken },
  });
}

export async function listManagedPages(userToken: string): Promise<MetaPage[]> {
  const json = await graphRequest<{ data: MetaPage[] }>("/me/accounts", { token: userToken, query: { fields: "id,name,access_token,instagram_business_account{id,username,name}", limit: "100" } });
  return json.data ?? [];
}

export async function subscribePageToWebhooks(pageId: string, pageToken: string): Promise<void> {
  await graphRequest<{ success: boolean }>(`/${pageId}/subscribed_apps`, { method: "POST", token: pageToken, query: { subscribed_fields: "messages,messaging_postbacks,message_deliveries,message_reads" } });
}

export async function sendPageMessage(pageId: string, pageToken: string, recipientPsid: string, text: string): Promise<{ recipient_id: string; message_id: string }> {
  return graphRequest(`/${pageId}/messages`, { method: "POST", token: pageToken, body: { recipient: { id: recipientPsid }, messaging_type: "RESPONSE", message: { text } } });
}

export async function sendInstagramMessage(igAccountId: string, pageToken: string, recipientIgsid: string, text: string): Promise<{ recipient_id: string; message_id: string }> {
  return graphRequest(`/${igAccountId}/messages`, { method: "POST", token: pageToken, body: { recipient: { id: recipientIgsid }, message: { text } } });
}

export async function getScopedUserProfile(scopedId: string, pageToken: string, platform: "INSTAGRAM" | "FACEBOOK"): Promise<{ name: string | null; username: string | null }> {
  try {
    const fields = platform === "INSTAGRAM" ? "name,username" : "name,first_name,last_name";
    const json = await graphRequest<{ name?: string; username?: string; first_name?: string; last_name?: string }>(`/${scopedId}`, { token: pageToken, query: { fields } });
    const name = json.name ?? [json.first_name, json.last_name].filter(Boolean).join(" ") ?? null;
    return { name: name || null, username: json.username ?? null };
  } catch {
    return { name: null, username: null };
  }
}

/** Validate X-Hub-Signature-256 for a raw webhook body. */
export function verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string | null | undefined, appSecret: string | undefined): boolean {
  if (!appSecret || !signatureHeader) return false;
  const [algo, provided] = signatureHeader.split("=");
  if (algo !== "sha256" || !provided) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
