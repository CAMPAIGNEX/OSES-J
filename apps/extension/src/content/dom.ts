/** DOM helpers shared by the Instagram and Facebook content scripts. Robust state detection, never blind clicks. */
import type { ClaimedJob, ContentRequest, ContentResponse, JobResult, ProgressStatus, RuntimeEvent } from "../shared/protocol";

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitFor<T>(fn: () => T | null | undefined | false, timeoutMs: number, intervalMs = 250): Promise<T | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const v = fn();
    if (v) return v as T;
    await sleep(intervalMs);
  }
  return null;
}

export function isVisible(el: Element): boolean {
  const rect = (el as HTMLElement).getBoundingClientRect();
  const style = getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

export function textOf(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Find a visible clickable element whose visible text matches one of the labels exactly (case-insensitive). */
export function findButtonByText(labels: string[], root: ParentNode = document): HTMLElement | null {
  const wanted = labels.map((l) => l.toLowerCase());
  const candidates = root.querySelectorAll<HTMLElement>('button, [role="button"], a[role="link"], div[tabindex="0"]');
  for (const el of candidates) {
    const t = textOf(el).toLowerCase();
    if (wanted.includes(t) && isVisible(el)) return el;
    const aria = (el.getAttribute("aria-label") ?? "").toLowerCase();
    if (aria && wanted.includes(aria) && isVisible(el)) return el;
  }
  return null;
}

export function pageContains(patterns: RegExp[]): RegExp | null {
  const text = document.body?.innerText ?? "";
  return patterns.find((p) => p.test(text)) ?? null;
}

export function findComposer(root: ParentNode = document): HTMLElement | null {
  const selectors = ['div[role="dialog"] div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"][role="textbox"]', 'textarea[placeholder*="essage" i]', "textarea"];
  for (const s of selectors) {
    const els = root.querySelectorAll<HTMLElement>(s);
    for (const el of els) if (isVisible(el)) return el;
  }
  return null;
}

/** Insert text the way a user would, so React-controlled inputs pick it up. */
export function insertText(el: HTMLElement, text: string): boolean {
  el.focus();
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return el.value === text;
  }
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  selection?.removeAllRanges();
  selection?.addRange(range);
  let ok = false;
  try {
    ok = document.execCommand("insertText", false, text);
  } catch {
    ok = false;
  }
  if (!ok) {
    el.textContent = text;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
  }
  return textOf(el).includes(text.trim().slice(0, 40));
}

export function pressEnter(el: HTMLElement): void {
  for (const type of ["keydown", "keypress", "keyup"] as const) {
    el.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  }
}

export function report(event: RuntimeEvent): void {
  void chrome.runtime.sendMessage(event).catch(() => undefined);
}

export function progress(jobId: string, status: ProgressStatus, detail?: string): void {
  report({ type: "OSES_JOB_PROGRESS", jobId, status, detail });
}

export function result(jobId: string, r: JobResult): void {
  report({ type: "OSES_JOB_RESULT", jobId, result: r });
}

/** Wire up the message listener for a platform content script. */
export function registerContentScript(platform: "INSTAGRAM" | "FACEBOOK", detectLoggedIn: () => boolean | null, execute: (job: ClaimedJob) => Promise<JobResult>): void {
  let busy = false;
  chrome.runtime.onMessage.addListener((message: ContentRequest, _sender, sendResponse) => {
    if (message.type === "OSES_PING") {
      sendResponse({ type: "OSES_PONG", loggedIn: detectLoggedIn(), url: location.href, platform } satisfies ContentResponse);
      return false;
    }
    if (message.type === "OSES_EXECUTE_JOB") {
      sendResponse({ type: "OSES_ACK" } satisfies ContentResponse);
      if (busy) {
        result(message.job.id, { status: "FAILED", errorCode: "UNKNOWN", errorMessage: "Another job is running in this tab" });
        return false;
      }
      busy = true;
      const started = Date.now();
      execute(message.job)
        .then((r) => result(message.job.id, { ...r, evidence: { ...r.evidence, durationMs: Date.now() - started, finalUrl: location.href } }))
        .catch((err: Error) => result(message.job.id, { status: "FAILED", errorCode: "UNKNOWN", errorMessage: err.message }))
        .finally(() => {
          busy = false;
        });
      return false;
    }
    return false;
  });
}
