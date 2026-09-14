/**
 * Instagram content script: performs one direct-message job inside the user's own session.
 *
 * Every step verifies page state before acting (logged in? profile exists? Message button? composer?
 * restriction warnings? message actually appeared in the thread?). If a check fails the job stops with
 * a precise error code instead of clicking blindly.
 */
import type { ClaimedJob, JobResult } from "../shared/protocol";
import { findButtonByText, findComposer, insertText, pageContains, pressEnter, progress, registerContentScript, sleep, textOf, waitFor } from "./dom";

const RESTRICTION_PATTERNS = [/action blocked/i, /try again later/i, /we restrict certain activity/i, /you can.?t message this account/i, /couldn.?t send/i, /message failed to send/i];
const NOT_FOUND_PATTERNS = [/sorry, this page isn.?t available/i, /page not found/i, /the link you followed may be broken/i];

function detectLoggedIn(): boolean | null {
  if (/\/accounts\/login/.test(location.pathname)) return false;
  if (document.querySelector('form input[name="username"]') && document.querySelector('form input[name="password"]')) return false;
  if (document.querySelector('a[href="/direct/inbox/"], a[href*="/direct/"], svg[aria-label="Home"], nav a[href="/"]')) return true;
  if (document.querySelector('a[href*="/accounts/login"]') && !document.querySelector('nav a[href="/"]')) return false;
  return null;
}

async function execute(job: ClaimedJob): Promise<JobResult> {
  const text = job.payload.text;
  await sleep(1500);
  if (detectLoggedIn() === false) return { status: "REQUIRES_USER", errorCode: "NOT_LOGGED_IN", errorMessage: "Not logged in to Instagram" };
  if (pageContains(NOT_FOUND_PATTERNS)) return { status: "FAILED", errorCode: "TARGET_NOT_FOUND", errorMessage: "Instagram profile not found" };

  const onThread = /\/direct\/t\//.test(location.pathname);
  if (!onThread) {
    // Profile page: locate the Message button (never guess selectors; require visible text).
    const messageButton = await waitFor(() => findButtonByText(["Message", "Send message"]), 10_000);
    if (!messageButton) {
      const hasFollow = findButtonByText(["Follow", "Follow back", "Requested", "Following"]);
      const restriction = pageContains(RESTRICTION_PATTERNS);
      if (restriction) return { status: "BLOCKED", errorCode: "ACCOUNT_RESTRICTED", errorMessage: `Instagram shows a restriction: ${restriction.source}` };
      return { status: "FAILED", errorCode: "MESSAGE_BUTTON_NOT_FOUND", errorMessage: hasFollow ? "Profile has no Message button (private account or messaging disabled)" : "Could not find the Message button on the profile" };
    }
    progress(job.id, "TARGET_FOUND", `profile ${location.pathname}`);
    messageButton.click();
    const navigated = await waitFor(() => /\/direct\/t\//.test(location.pathname) || findComposer(), 15_000);
    if (!navigated) return { status: "FAILED", errorCode: "COMPOSER_NOT_FOUND", errorMessage: "Conversation view did not open" };
  } else {
    progress(job.id, "TARGET_FOUND", `thread ${location.pathname}`);
  }

  const composer = await waitFor(() => findComposer(), 15_000);
  if (!composer) return { status: "FAILED", errorCode: "COMPOSER_NOT_FOUND", errorMessage: "Message composer not found" };
  const warning = pageContains(RESTRICTION_PATTERNS);
  if (warning) return { status: "BLOCKED", errorCode: "ACCOUNT_RESTRICTED", errorMessage: `Instagram shows a warning: ${warning.source}` };
  progress(job.id, "COMPOSER_FOUND");

  if (!insertText(composer, text)) return { status: "FAILED", errorCode: "COMPOSER_NOT_FOUND", errorMessage: "Could not type into the composer" };
  await sleep(600);
  progress(job.id, "SENDING");
  const sendButton = findButtonByText(["Send"]);
  if (sendButton) sendButton.click();
  else pressEnter(composer);

  // Confirmation: composer cleared and our text appears as the latest message in the thread.
  const snippet = text.trim().slice(0, 60);
  const confirmed = await waitFor(() => {
    const composerNow = findComposer();
    const cleared = !composerNow || textOf(composerNow).length === 0;
    const bodyText = document.body?.innerText ?? "";
    return cleared && bodyText.includes(snippet);
  }, 12_000, 400);
  if (!confirmed) {
    const late = pageContains(RESTRICTION_PATTERNS);
    if (late) return { status: "BLOCKED", errorCode: "ACCOUNT_RESTRICTED", errorMessage: `Instagram blocked the send: ${late.source}` };
    return { status: "FAILED", errorCode: "SEND_NOT_CONFIRMED", errorMessage: "The message did not appear in the conversation" };
  }
  const threadId = /\/direct\/t\/(\d+)/.exec(location.pathname)?.[1];
  return { status: "SENT", evidence: { threadId, sentText: text } };
}

registerContentScript("INSTAGRAM", detectLoggedIn, execute);
