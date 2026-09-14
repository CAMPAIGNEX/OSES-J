import { loadConfig, loadState, pair, saveConfig, updateState } from "../shared/api";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function render(): Promise<void> {
  const config = await loadConfig();
  const state = await loadState();
  $("pair").hidden = Boolean(config);
  $("connected").hidden = !config;
  $("activityCard").hidden = !config;
  if (config) {
    const fresh = state.lastHeartbeatAt && Date.now() - new Date(state.lastHeartbeatAt).getTime() < 90_000;
    const dot = $("dot");
    dot.className = `dot ${config.paused ? "warn" : fresh ? "on" : ""}`;
    $("statusText").textContent = config.paused ? "Paused" : fresh ? "Connected" : "Waiting for heartbeat…";
    $("serverText").textContent = config.serverUrl;
    const li = state.loggedIn;
    const fmt = (v: boolean | null) => (v === null ? "unknown (open a tab)" : v ? "logged in" : "NOT logged in");
    $("loginText").textContent = `Instagram: ${fmt(li.instagram)} · Facebook: ${fmt(li.facebook)}`;
    $("jobText").textContent = state.currentJobId ? `Working on job …${state.currentJobId.slice(-8)}` : `Idle${state.lastClaimAt ? ` · last check ${new Date(state.lastClaimAt).toLocaleTimeString()}` : ""}${state.lastError ? ` · ${state.lastError}` : ""}`;
    $("pauseBtn").textContent = config.paused ? "Resume" : "Pause";
    const list = $("activity");
    list.innerHTML = "";
    for (const a of state.activity.slice(0, 12)) {
      const item = document.createElement("li");
      item.className = a.level;
      item.textContent = `${new Date(a.at).toLocaleTimeString()} ${a.message}`;
      list.appendChild(item);
    }
  }
}

$("pairBtn").addEventListener("click", async () => {
  const btn = $<HTMLButtonElement>("pairBtn");
  const error = $("pairError");
  error.hidden = true;
  btn.disabled = true;
  try {
    const serverUrl = $<HTMLInputElement>("server").value.trim().replace(/\/+$/, "");
    let origin: string;
    try {
      origin = new URL(serverUrl).origin;
    } catch {
      throw new Error("Enter the full server URL, e.g. https://app.example.com");
    }
    // Host permission for the OSES J server lets the worker call the API without CORS (asked once, on this click).
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) throw new Error("Permission to contact the OSES J server was not granted");
    await pair(serverUrl, $<HTMLInputElement>("code").value.trim().toUpperCase());
    await chrome.runtime.sendMessage({ type: "OSES_TICK_NOW" }).catch(() => undefined);
    await render();
  } catch (err) {
    error.textContent = (err as Error).message;
    error.hidden = false;
  } finally {
    btn.disabled = false;
  }
});

$("pauseBtn").addEventListener("click", async () => {
  const config = await loadConfig();
  if (!config) return;
  await saveConfig({ ...config, paused: !config.paused });
  await render();
});

$("checkBtn").addEventListener("click", async () => {
  $<HTMLButtonElement>("checkBtn").disabled = true;
  await chrome.runtime.sendMessage({ type: "OSES_TICK_NOW" }).catch(() => undefined);
  await render();
  $<HTMLButtonElement>("checkBtn").disabled = false;
});

$("disconnectBtn").addEventListener("click", async () => {
  if (!confirm("Disconnect this browser from OSES J?")) return;
  await saveConfig(null);
  await updateState({ currentJobId: null, lastHeartbeatAt: null, activity: [] });
  await render();
});

chrome.storage.onChanged.addListener(() => void render());
void render();
