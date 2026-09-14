import { EXTENSION_VERSION, STORAGE_KEYS, type ActivityEntry, type ClaimedJob, type ExtensionConfig, type ExtensionState, type JobResult, type ProgressStatus } from "./protocol";

export async function loadConfig(): Promise<ExtensionConfig | null> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.config);
  return (res[STORAGE_KEYS.config] as ExtensionConfig | undefined) ?? null;
}

export async function saveConfig(config: ExtensionConfig | null): Promise<void> {
  if (!config) await chrome.storage.local.remove(STORAGE_KEYS.config);
  else await chrome.storage.local.set({ [STORAGE_KEYS.config]: config });
}

const defaultState: ExtensionState = { currentJobId: null, lastHeartbeatAt: null, lastClaimAt: null, lastError: null, loggedIn: { instagram: null, facebook: null }, activity: [] };

export async function loadState(): Promise<ExtensionState> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.state);
  return { ...defaultState, ...((res[STORAGE_KEYS.state] as Partial<ExtensionState> | undefined) ?? {}) };
}

export async function updateState(patch: Partial<ExtensionState>): Promise<ExtensionState> {
  const current = await loadState();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [STORAGE_KEYS.state]: next });
  return next;
}

export async function logActivity(level: ActivityEntry["level"], message: string): Promise<void> {
  const state = await loadState();
  const activity = [{ at: new Date().toISOString(), level, message }, ...state.activity].slice(0, 30);
  await chrome.storage.local.set({ [STORAGE_KEYS.state]: { ...state, activity, ...(level === "error" ? { lastError: message } : {}) } });
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

/** Server client: bearer-token auth with automatic refresh. The OSES J password never enters the extension. */
export class ServerClient {
  constructor(private config: ExtensionConfig) {}

  private async refreshIfNeeded(): Promise<void> {
    const expires = new Date(this.config.accessTokenExpiresAt).getTime();
    if (Number.isFinite(expires) && expires - Date.now() > 60_000) return;
    const res = await fetch(`${this.config.serverUrl}/api/extension/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: this.config.refreshToken }) });
    if (!res.ok) throw new ApiError(res.status, "REFRESH_FAILED", "Session expired. Pair the extension again from OSES J settings.");
    const data = (await res.json()) as { accessToken: string; accessTokenExpiresAt: string; refreshToken: string; refreshTokenExpiresAt: string };
    this.config = { ...this.config, ...data };
    await saveConfig(this.config);
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    await this.refreshIfNeeded();
    const res = await fetch(`${this.config.serverUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.accessToken}` }, body: JSON.stringify(body ?? {}) });
    const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;
    if (!res.ok) throw new ApiError(res.status, json.error?.code ?? "REQUEST_FAILED", json.error?.message ?? `Request failed (${res.status})`);
    return json;
  }

  heartbeat(input: { status: "ready" | "busy" | "needs_login" | "error"; loggedIn: { instagram: boolean | null; facebook: boolean | null }; currentJobId: string | null }) {
    const loggedIn: Record<string, boolean> = {};
    if (input.loggedIn.instagram !== null) loggedIn.instagram = input.loggedIn.instagram;
    if (input.loggedIn.facebook !== null) loggedIn.facebook = input.loggedIn.facebook;
    return this.request<{ ok: boolean; extensionEnabled: boolean }>("/api/extension/heartbeat", { status: input.status, capabilities: { instagram: true, facebook: true, loggedIn }, extensionVersion: EXTENSION_VERSION, currentJobId: input.currentJobId });
  }

  claim(platforms: Array<"INSTAGRAM" | "FACEBOOK">) {
    return this.request<{ job: ClaimedJob | null }>("/api/extension/jobs/claim", { platforms });
  }

  progress(jobId: string, status: ProgressStatus, detail?: string) {
    return this.request<{ ok: boolean }>(`/api/extension/jobs/${jobId}/progress`, { status, detail });
  }

  result(jobId: string, result: JobResult) {
    return this.request<{ ok: boolean; status: string }>(`/api/extension/jobs/${jobId}/result`, result);
  }
}

export async function pair(serverUrl: string, pairingCode: string): Promise<ExtensionConfig> {
  const base = serverUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/api/extension/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pairingCode, deviceName: `Chrome on ${navigator.platform || "desktop"}`, browser: navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] ?? "Chrome", extensionVersion: EXTENSION_VERSION }) });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string }; deviceId: string; organizationId: string; accessToken: string; accessTokenExpiresAt: string; refreshToken: string; refreshTokenExpiresAt: string };
  if (!res.ok) throw new ApiError(res.status, "PAIR_FAILED", json.error?.message ?? "Pairing failed");
  const config: ExtensionConfig = { serverUrl: base, deviceId: json.deviceId, organizationId: json.organizationId, accessToken: json.accessToken, accessTokenExpiresAt: json.accessTokenExpiresAt, refreshToken: json.refreshToken, refreshTokenExpiresAt: json.refreshTokenExpiresAt, paused: false };
  await saveConfig(config);
  return config;
}
