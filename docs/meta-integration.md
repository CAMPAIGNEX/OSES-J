# Meta (Instagram / Facebook) official integration

The official Meta integration is the only path with real delivery/read status and the only path allowed for *replying* to conversations that customers started. Meta does not allow cold outreach to accounts that never messaged the Page, so first contact still goes through the extension, Apify or manual sending.

## App setup

1. Create an app at developers.facebook.com (type *Business*), add **Facebook Login for Business**, **Messenger** and **Instagram** products.
2. Set `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` (any random string), `META_GRAPH_VERSION` (default `v21.0`).
3. Valid OAuth redirect URI: `https://<APP_URL>/api/social/meta/callback`.
4. Webhooks (product *Webhooks*): callback URL `https://<APP_URL>/api/webhooks/meta`, verify token = `META_WEBHOOK_VERIFY_TOKEN`. Subscribe the **page** object (`messages`, `messaging_postbacks`, `message_deliveries`, `message_reads`) and the **instagram** object (`messages`).
5. Requested permissions: `pages_show_list`, `pages_manage_metadata`, `pages_messaging`, `instagram_basic`, `instagram_manage_messages`, `business_management`. Advanced access requires Meta App Review before non-test users can connect.

## Connecting accounts

**Settings > Social accounts > Connect Meta** -> `GET /api/social/meta/connect` builds the OAuth URL with a signed state (`createOAuthState`, HMAC with `AUTH_SECRET`, 10-minute expiry) -> callback exchanges the code for a long-lived user token -> lists Pages and their linked Instagram professional accounts -> stores one `SocialConnection` per Page and per Instagram account with the **page access token encrypted** (`ENCRYPTION_KEY`) -> subscribes the Page to the app webhooks.

## Inbound (webhooks)

`POST /api/webhooks/meta` verifies `X-Hub-Signature-256` against the raw body, returns 200 immediately and processes events through `processMetaWebhook`:

- Message events are recorded in `WebhookEvent` keyed by `mid` (unique); redeliveries are counted as duplicates and ignored.
- Unknown senders become a new client (with CID) + `ClientSocialAccount` (with `scopedUserId`, eligibility `MESSAGEABLE`); the profile name/username is fetched from the Graph API when the token allows it.
- Echoes (messages sent from the Meta inbox by a human) are stored as outbound `USER` messages so the OSES J inbox stays complete.
- `delivery` / `read` events update outbound messages to `DELIVERED` / `SEEN`.
- New inbound messages enqueue `AI_REPLY_JOB` (classification + reply pipeline).

## Outbound

`MetaMessagingProvider.canSend` requires a connected account for the platform and a `scopedUserId` (an existing thread). Sending uses `POST /{ig-user-id}/messages` (Instagram) or `POST /{page-id}/messages` (Facebook, within the 24-hour window). Token errors (code 190) mark the connection `EXPIRED` and the message `REQUIRES_USER` with a reconnect prompt; rate limits are retried with backoff.

## Testing without app review

Use a test user / your own Page in development: developer-role users can connect without advanced access. Webhooks can be replayed from the Meta dashboard; `pnpm test:integration` covers the processing logic (idempotency, client creation, provider capability) with synthetic payloads.
