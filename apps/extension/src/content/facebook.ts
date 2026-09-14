/**
 * Facebook content script: messages a Page from the user's own session.
 * Same defensive approach as Instagram: verify login, page existence, Message button, composer,
 * warnings and delivery before reporting success.
 */
import type { ClaimedJob, JobResult } from "../shared/protocol";
import { findButtonByText, findComposer, insertText, pageContains, pressEnter, progress, registerContentScript, sleep, textOf, waitFor } from "./dom";

const RESTRICTION_PATTERNS = [/you can.?t send messages/i, /temporarily blocked/i, /you.?re temporarily restricted/i, /message not sent/i, /couldn.?t send/i, /this feature isn.?t available right now/i];
const NOT_FOUND_PATTERNS = [/this content isn.?t available/i, /page not found/i, /this page isn.?t available/i];

function detectLoggedIn(): boolean | null {
  if (/\/login/.test(location.pathname)) return false;
  if (document.querySelector('form[action*="login"] input[name="email"]') && document.querySelector('input[name="pass"]')) return false;
  if (document.querySelector('[aria-label="Your profile"], [aria-label="Messenger"], [aria-label="Account"], a[href*="/messages/"]')) return true;
  return null;
}

async function execute(job: ClaimedJob): Promise<JobResult> {
  const text = job.payload.text;
  await sleep(1500);
  if (detectLoggedIn() === false) return { status: "REQUIRES_USER", errorCode: "NOT_LOGGED_IN", errorMessage: "Not logged in to Facebook" };
  if (pageContains(NOT_FOUND_PATTERNS)) return { status: "FAILED", errorCode: "TARGET_NOT_FOUND", errorMessage: "Facebook page not found" };

  const onThread = /\/messages\/t\//.test(location.pathname);
  if (!onThread) {
    const messageButton = await waitFor(() => findButtonByText(["Message", "Send message", "Send Message"]), 10_000);
    if (!messageButton) {
      const restriction = pageContains(RESTRICTION_PATTERNS);
      if (restriction) return { status: "BLOCKED", errorCode: "ACCOUNT_RESTRICTED", errorMessage: `Facebook shows a restriction: ${restriction.source}` };
      return { status: "FAILED", errorCode: "MESSAGE_BUTTON_NOT_FOUND", errorMessage: "This page does not expose a Message button" };
    }
    progress(job.id, "TARGET_FOUND", `page ${location.pathname}`);
    messageButton.click();
  } else {
    progress(job.id, "TARGET_FOUND", `thread ${location.pathname}`);
  }
  const composer = await waitFor(() => findComposer(), 15_000);
  if (!composer) return { status: "FAILED", errorCode: "COMPOSER_NOT_FOUND", errorMessage: "Messenger composer not found" };
  const warning = pageContains(RESTRICTION_PATTERNS);
  if (warning) return { status: "BLOCKED", errorCode: "ACCOUNT_RESTRICTED", errorMessage: `Facebook shows a warning: ${warning.source}` };
  progress(job.id, "COMPOSER_FOUND");
  if (!insertText(composer, text)) return { status: "FAILED", errorCode: "COMPOSER_NOT_FOUND", errorMessage: "Could not type into the composer" };
  await sleep(600);
  progress(job.id, "SENDING");
  const sendButton = findButtonByText(["Send", "Press Enter to send"]) ?? document.querySelector<HTMLElement>('[aria-label="Press Enter to send"], [aria-label="Send"]');
  if (sendButton) sendButton.click();
  else pressEnter(composer);
  const snippet = text.trim().slice(0, 60);
  const confirmed = await waitFor(() => {
    const c = findComposer();
    const cleared = !c || textOf(c).length === 0;
    return cleared && (document.body?.innerText ?? "").includes(snippet);
  }, 12_000, 400);
  if (!confirmed) {
    const late = pageContains(RESTRICTION_PATTERNS);
    if (late) return { status: "BLOCKED", errorCode: "ACCOUNT_RESTRICTED", errorMessage: `Facebook blocked the send: ${late.source}` };
    return { status: "FAILED", errorCode: "SEND_NOT_CONFIRMED", errorMessage: "The message did not appear in the conversation" };
  }
  const threadId = /\/messages\/t\/([^/?]+)/.exec(location.pathname)?.[1];
  return { status: "SENT", evidence: { threadId, sentText: text } };
}

registerContentScript("FACEBOOK", detectLoggedIn, execute);
