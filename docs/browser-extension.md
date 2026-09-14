# Browser extension

`apps/extension` is a Chrome Manifest V3 extension. It is the primary browser-automation interface: OSES-J creates delivery jobs; the extension, running in the exporter's own logged-in browser, performs the UI action and reports the result. It never sees Instagram/Facebook passwords and never receives the OSES-J password.

## Build & install

```bash
pnpm extension:build      # esbuild → apps/extension/dist (background.js, content-*.js, popup.*, manifest.json, icons)
```

Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → select `apps/extension/dist`.

## Pairing

1. OSES-J: **Settings → Automation → Pair extension** → `POST /api/extension/pairing` returns an 8-character code valid for 10 minutes (only its hash is stored).
2. Extension popup: enter the server URL and the code. The popup requests host permission for that origin (so the worker can call the API) and calls `POST /api/extension/auth`.
3. The server creates an `ExtensionDevice` and returns an access token (1 h, `EXTENSION_ACCESS_TOKEN_TTL_MINUTES`) and a refresh token (30 days). Both are stored hashed server-side; the extension keeps them in `chrome.storage.local` and rotates them through `POST /api/extension/refresh`.

## Job flow

```
alarm (30 s) → heartbeat (status, login state) → claim → open target tab → content script
   → OPENING_TARGET → TARGET_FOUND → COMPOSER_FOUND → SENDING → result (SENT | FAILED | BLOCKED | REQUIRES_USER)
```

- `POST /api/extension/heartbeat` — marks the device online, reports `loggedIn` per platform and the current job; the server answers with `extensionEnabled`.
- `POST /api/extension/jobs/claim` — atomic claim of the next queued `EXTENSION` job for the organization (10-minute lease; expired leases are re-queued).
- `POST /api/extension/jobs/:id/progress` — intermediate states.
- `POST /api/extension/jobs/:id/result` — final state with evidence (`finalUrl`, `threadId`, `sentText`, `durationMs`). The server maps error codes to retry (`RATE_LIMITED`, transient), permanent failure (`TARGET_NOT_FOUND`, `MESSAGE_BUTTON_NOT_FOUND`) or user action (`NOT_LOGGED_IN`, `ACCOUNT_RESTRICTED`, `PAGE_WARNING`).

## Never blindly click

Content scripts verify state at every step: login page detection, "page not available" text, a visible **Message** button found by its text/aria-label (not by generated class names), the composer (`contenteditable` textbox or textarea), restriction/warning banners ("Action Blocked", "Try again later", "You can't message this account"), and finally that the composer cleared **and** the sent text appears in the thread. Any failed check stops the job with a precise error code; `REQUIRES_USER` results bring the tab to the foreground so the user can act (e.g. log in).

## Limitations

- Instagram/Facebook change their DOM regularly. The selectors are text/role-based to be resilient, but the content scripts are the component most likely to need maintenance; results are always verified before reporting `SENT`.
- Only text messages are sent through the extension (attachments are listed for the user to send manually).
- One job at a time per device; the server leases jobs so a crashed browser does not lose them.
- The extension respects organization settings: when the extension is disabled in Settings → Automation, claims return nothing.
