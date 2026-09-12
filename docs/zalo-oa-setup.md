# Zalo OA Setup & Go-Live Runbook

How to create the Zalo credentials, link the Official Account, wire the webhook,
bootstrap the tokens and verify the integration end to end.

> Companion to the short section in [README.md](../README.md). Everything here
> refers to the current Zalo OA Open API v3.0 and the OAuth v4 endpoints that
> `src/lib/zalo/*` uses.

---

## 0. Deployment readiness (read this first)

The application code is ready; Zalo go-live is mostly credentials + config.
Before switching `ZALO_TRANSPORT=live`, note these items:

| # | Item | Status / action |
| - | ---- | --------------- |
| 1 | Webhook signature verification | **Done** — `sha256(appId + rawBody + timestamp + OA Secret)` with `X-ZEvent-Signature`; fails closed. |
| 2 | Webhook idempotency (Zalo retries) | **Done** — de-duplicated on Zalo `msg_id`; the route always 200s. |
| 3 | Token storage + rotation | **Done** — `zalo_oa_token` row, refreshed 5 min before expiry, new refresh token persisted. |
| 4 | Concurrency at refresh time | **Known edge** — Zalo refresh tokens are single-use. Two simultaneous sends exactly at refresh can cause one send to fail. Fine at low volume; add a Postgres advisory lock if traffic grows. |
| 5 | `request_user_info` template | **Unused** — linking is invite-code only, the bot no longer requests phone info. `client-real.ts` now sends the app logo (`NEXT_PUBLIC_APP_URL/logo.png`); Zalo rejects empty/localhost URLs, so it only succeeds once the app has a public HTTPS URL. |
| 6 | Message window | **Limit** — CS messages only within **7 days** of the user's last interaction; free within 48h, paid after (see §6.4). Outside 7 days, delivery fails — needs ZNS template (not implemented). |
| 7 | `ALLOWED_MANAGER_EMAILS` | **Must be non-empty in production** — an empty allowlist blocks every sign-in outside dev. |
| 8 | Cron scheduler | Wire `CRON_SECRET` + an hourly trigger, or due-date reminders are disabled (503). |
| 9 | OA Tier Package | **Check before go-live** — Zalo rejects button/template messages with `-224` ("The OA needs to upgrade OA Tier Package") on a free/lower OA tier. Upgrade the OA package, otherwise task cards never reach employees (the failure is shown in the task timeline). |

Everything else (Google OAuth, Postgres hosting, Next.js deployment) is assumed
handled — a short non-Zalo checklist is in §8.

---

## 1. How the integration works

| Direction | Endpoint | Used for |
| --------- | -------- | -------- |
| Zalo → app | `POST https://<host>/api/zalo/webhook` | `user_send_text`, `user_send_image`, `follow`, `unfollow`, `user_submit_info` |
| app → Zalo | `POST https://openapi.zalo.me/v3.0/oa/message/cs` | assignment cards, acknowledgements, reminders (`sendText` / `sendButtons`) |
| app → Zalo | `GET https://openapi.zalo.me/v3.0/oa/user/detail?data={"user_id":…}` | display name when linking |
| app → Zalo | `POST https://oauth.zaloapp.com/v4/oa/access_token` | refresh the access token (single-use refresh rotation) |

Flow: the company **Zalo Official Account** serves both employees and
customers. The Zalo id is looked up on `employee.zaloUserId` on every inbound
event:

- **Linked** → employee flow. Buttons on task cards carry a payload like
  `task:start:<task-uuid>`; tapping one sends a normal text message back to
  the OA, and the bot decodes it. The Zalo user id, the task id in the payload
  and the assignee on that task must line up.
- **Not linked** → customer flow. The message is logged and gets one neutral
  acknowledgement; it is never answered with a "not connected" hint. The only
  way into the employee flow is a 4-consonant invite code, matched anywhere
  in the message
  (`src/lib/workflow/employee-linking.ts`).

Inbound events are parsed in `src/lib/zalo/parse.ts` and routed in
`src/lib/workflow/conversation.ts` (employee) or
`src/lib/workflow/client-conversation.ts` (customer).

### Webhook event mapping

| `event_name` | App behaviour |
| ------------ | ------------- |
| `user_send_text` | Linked: button payloads (`task:*`), invite code, issue description, done note, comment. Unlinked: invite code or customer acknowledgement |
| `user_send_image` | Linked: completion photo or issue photo (stored as `task_attachment`). Unlinked: customer acknowledgement |
| `follow` | Greets with both options (employee → invite code, customer → leave a message); inactive employees get a notice |
| `unfollow` | Marks the linked employee `inactive`; unlinked users are just logged |
| `user_submit_info` | Logged (visible in the portal client inbox); does **not** link an account |
| everything else | Ignored (including `oa_send_*`, which would cause loops) |

---

## 2. Prerequisites

- A Zalo account that can become **admin of a Zalo Official Account** (OA).
- The OA already created and, ideally, verified in
  [OA Manager](https://oa.zalo.me) (some capabilities and quotas depend on OA
  verification/package; a basic OA is enough for CS messaging).
- A public **HTTPS** domain for the app. Zalo rejects plain HTTP webhooks.
- App secrets stored in your deployment's secret manager, never committed.

---

## 3. Step-by-step: credentials and linking

### A. Create the Zalo app

1. Sign in at <https://developers.zalo.me> → **Tạo ứng dụng / Create App**.
2. Fill in name, description and your domain; note the **App ID**.
3. Open the app → **Settings / Cài đặt** → copy the **Secret Key**
   (this is `ZALO_APP_SECRET`, the *App* secret).
4. Enable the **Official Account API** product for the app.

### B. Link the OA and grant permissions

1. In the app, go to **Official Account / Liên kết OA** and link the OA.
2. Grant the app these OA permissions (names from the consent screen):
   - **Quyền gửi tin và thông báo qua OA** — send messages (`message/cs`)
   - **Quyền quản lý thông tin người dùng** — `user/detail` (display name)
   - **Quyền nhận sự kiện quản lý tin nhắn** — message webhooks
   - **Quyền nhận sự kiện quản lý người dùng** — follow/unfollow/info webhooks
3. Only the OA admin can approve the consent prompt.

### C. Collect the three secrets

| Env var | Where |
| ------- | ----- |
| `ZALO_APP_ID` | developers.zalo.me → app → **App ID** |
| `ZALO_APP_SECRET` | developers.zalo.me → app → **Secret Key** (used as the `secret_key` header on OAuth calls) |
| `ZALO_OA_SECRET` | OA Manager → **Cài đặt / Quản lý ứng dụng → Webhook / OA Secret Key** (used for webhook signatures) |

> `ZALO_OA_SECRET` is **not** the App Secret Key. Mixing them up makes every
> webhook fail signature verification with 401.

### D. Configure the webhook

1. In the app (or OA Manager → **Quản lý ứng dụng → Cấu hình Webhook**) set the
   callback URL:
   `https://<your-domain>/api/zalo/webhook`
2. Subscribe to exactly these events:
   `user_send_text`, `user_send_image`, `follow`, `unfollow`, `user_submit_info`.
3. Save; Zalo may call the URL with `GET` — the route answers
   `200 "Zalo OA webhook OK"`. `POST`s are signature-verified.
4. Verify reachability from the public internet (no auth proxy in front of the
   webhook; `src/proxy.ts` already excludes `/api/zalo` from the login gate).

### E. Get the first token pair (one-time OAuth bootstrap)

The app has **no built-in OAuth callback route** — do this once manually.
Tokens live 25 h (access) and 3 months (refresh); after the first refresh they
are stored in the `zalo_oa_token` table and the `.env` values are ignored.

Zalo requires PKCE. Generate a verifier/challenge pair:

```bash
code_verifier=$(openssl rand -base64 64 | tr -d '=+/\n' | cut -c1-43)
code_challenge=$(printf %s "$code_verifier" \
  | openssl dgst -binary -sha256 \
  | openssl base64 | tr '+/' '-_' | tr -d '=')
printf 'code_verifier=%s\ncode_challenge=%s\n' "$code_verifier" "$code_challenge"
```

Register a **Callback URL** in the app settings (any URL you control — the app
does not need to handle it; you will copy `code` from the address bar), then
open this as the OA admin and press **Cho phép / Allow**:

```
https://oauth.zaloapp.com/v4/oa/permission?app_id=<ZALO_APP_ID>&redirect_uri=<CALLBACK_URL>&code_challenge=<code_challenge>
```

You are redirected to `<CALLBACK_URL>?code=<AUTH_CODE>&oa_id=<OA_ID>`. The code
is **single-use and expires in 10 minutes**. Exchange it immediately:

```bash
curl -s -X POST https://oauth.zaloapp.com/v4/oa/access_token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "secret_key: $ZALO_APP_SECRET" \
  --data-urlencode "code=$AUTH_CODE" \
  --data-urlencode "app_id=$ZALO_APP_ID" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code_verifier=$code_verifier"
```

The response contains `access_token`, `refresh_token`, `expires_in` (seconds).
Keep the **refresh_token** — it is the only one the app needs.

**Alternative:** developers.zalo.me → **Công cụ & Hỗ trợ → API Explorer** →
token type *OA Access Token* → pick the OA → grant → copy tokens. Handy for a
quick check, but the PKCE flow above is the reproducible way to get a refresh
token.

### F. Production environment

```env
NEXT_PUBLIC_APP_URL="https://your-domain"
BETTER_AUTH_URL="https://your-domain"
DATABASE_URL="postgres://…"                 # add ?sslmode=require for hosted PG
BETTER_AUTH_SECRET="…"                      # openssl rand -base64 32
GOOGLE_CLIENT_ID="…"                        # redirect URI: https://your-domain/api/auth/callback/google
GOOGLE_CLIENT_SECRET="…"
ALLOWED_MANAGER_EMAILS="manager@company.com,ops@company.com"

ZALO_TRANSPORT="live"
ZALO_APP_ID="…"
ZALO_APP_SECRET="…"
ZALO_OA_SECRET="…"
ZALO_OA_ACCESS_TOKEN=""                     # bootstrap placeholder; ignored after first refresh
ZALO_OA_REFRESH_TOKEN="…"                   # from step E — required on a fresh DB

CRON_SECRET="…"                             # openssl rand -hex 32
AUTH_BYPASS="false"
```

Notes:

- The first outbound Zalo call inserts the `zalo_oa_token` row and immediately
  refreshes using `ZALO_OA_REFRESH_TOKEN`. If that env value is missing on a
  fresh database, every send throws
  `Zalo OA not initialised: set ZALO_OA_ACCESS_TOKEN and ZALO_OA_REFRESH_TOKEN`.
- After one successful refresh you can remove both `ZALO_OA_*` values from the
  environment; the DB is the source of truth.
- `AUTH_BYPASS` is ignored when `NODE_ENV=production`, and the Zalo simulator
  (`/settings/zalo`) auto-disables unless `ZALO_TRANSPORT=mock` in dev.

### G. First smoke test (after deploy)

1. From a personal Zalo account, find the OA and press **Quan tâm** (Follow).
   The OA should reply with the welcome message (invite code for employees,
   leave a message for customers).
2. Send any text without a code → the bot replies with a customer
   acknowledgement, and the message shows under *Zalo OA → Tin nhắn khách hàng*.
3. In the portal: `/employees` → open an employee → **Tạo mã mời** → copy the code.
4. Send the code from that Zalo account → “Đã kết nối tài khoản…”, and the
   employee flips to *Đang hoạt động* with the Zalo id shown. The OA then sends
   the onboarding guide plus a practice task (safe to tap around).
5. `/tasks/new` → create a task assigned to that employee → the OA delivers the
   card with **▶️ Bắt đầu / ✔️ Đã xong / ⚠️ Báo sự cố / 📋 Việc của tôi** buttons.
6. Send a photo (or reply with a note), then tap **▶️ Bắt đầu** → **✔️ Đã xong**
   → the portal task moves to *Đã xong* with the photo in the gallery and every
   step in the timeline. Assignment needs no acceptance step, and *Đã xong*
   completes immediately (send any photo/note first).
7. Tap **⚠️ Báo sự cố** and describe it → task becomes *Gặp sự cố*.
8. Manager clicks **Xác nhận hoàn thành** → *Đã xác nhận*, and the OA notifies
   the employee.

If step 1 works but 5 does not, it is almost always the message window (§6.4) or
a rejected template — check `zalo_message_log` (§6.2).

---

## 4. Where things are stored / logged

| Data | Table |
| ---- | ----- |
| OA access + refresh token | `zalo_oa_token` (single row `id = "default"`) |
| Every inbound and outbound message | `zalo_message_log` (also powers the dev simulator) |
| Conversation state machine | `zalo_conversation` |
| Employee linking | `employee.zaloUserId` / `zaloDisplayName`, `employee_invite` |

`zalo_message_log.error` holds Zalo's error code/message for failed sends —
the first place to look when a message does not arrive.

### Log lines to watch (Vercel Runtime Logs)

Every Zalo interaction logs a single line; filter with `[zalo:` (and `[auth]`
for sign-in). A full inbound event produces a chain like this:

```
[zalo:webhook] received sig=ok event=user_send_text parsed=text sender=123 msg_id=abc in 3ms
[zalo:inbound] kind=text from=123 text="task:done:…"
[zalo:task] action=done task=… employee=… status=in_progress
[zalo:send] -> text to=123 text="✅ Đã báo hoàn thành DSX-1 · Tưới cây sảnh Cảm ơn bạn! Quản lý sẽ kiểm tra…"
[zalo:send] <- ok text to=123 http=200 message_id=… in 412ms
[zalo:inbound] handled kind=text from=123 in 780ms
```

| Prefix | What it shows |
| ------ | ------------- |
| `[zalo:webhook]` | HTTP request arrived; signature accepted (`sig=ok`), event name, parsed kind, sender, timing |
| `[zalo:webhook] rejected bad signature …` | OA secret mismatch / missing header — request dropped with 401 |
| `[zalo:inbound]` | Parsed event contents (text, image count, follow, phone) and handler result |
| `[zalo:link]` | Linking decisions: invite-code attempts, follow/unfollow, active/inactive |
| `[zalo:client]` | Unlinked user treated as a customer: auto-reply sent or skipped (within ack window) |
| `[zalo:state]` | Conversation state machine transitions (with `taskId` context) |
| `[zalo:task]` | Button actions, rejections (closed/not-yours), comments, done/issue notes |
| `[zalo:send] ->` | Outbound OA call about to be made (`text=…` / `buttons=[…]`) |
| `[zalo:send] <- ok` | Zalo accepted it, with `http`, `message_id` and latency |
| `[zalo:send] <- FAIL` | Zalo error (`error=<code> message="…"`) or network error, with latency |
| `[zalo:token]` | Token bootstrap/refresh: `refreshing`, `refreshed … expires_at=…`, or `refresh FAILED` |
| `[notification] send failed` | The lifecycle layer saw a send throw (details logged by the line above) |

Access tokens are never logged. Long message bodies are whitespace-collapsed and
capped at ~400 chars (`…(+N)` marks the truncation).

---

## 5. Operations

### 5.1 Token rotation

- Access token: ~25 h; refreshed automatically 5 minutes before expiry.
- Refresh token: 3 months, **single-use** — each refresh returns a new pair and
  invalidates the old one. The app persists it in `zalo_oa_token`.
- If refresh ever fails (`Zalo token refresh failed: … invalid refresh token`),
  the refresh token was used elsewhere, expired, or the app secret changed.
  Re-run §3.E to get a fresh pair and update `ZALO_OA_REFRESH_TOKEN` (delete the
  `zalo_oa_token` row first so the env value is picked up again):

  ```sql
  delete from zalo_oa_token where id = 'default';
  ```

### 5.2 Due-date reminders

`GET|POST /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET`.
Run it hourly (Vercel Cron, systemd timer, GitHub Actions, …). It nudges open
tasks due within 2 h or overdue, at most once per 12 h per task. Unset
`CRON_SECRET` → 503. See the README for the curl example.

### 5.3 Message de-duplication

Zalo retries a webhook up to 3× on non-200. The route verifies the signature,
returns 200, and `dispatchInbound` ignores duplicate `msg_id`s, so retries are
safe. Handler errors are caught and written to `zalo_message_log` instead of
failing the webhook.

### 5.4 Message window, free quota and costs (2026)

- Messages are sent with `message/cs` (Tư vấn / customer service).
- Allowed while the user has an interaction in the **last 7 days**.
- **Within 48 h** of the last interaction: free (since 1/1/2026, unlimited
  within the 48 h window).
- **Between 48 h and 7 days**: deliverable but charged (or drawn from the OA
  package quota).
- **After 7 days**: the API rejects the send. Out-of-window notifications need
  a registered **ZBS/ZNS template**, which this app does **not** implement.

Practical consequence: if an employee never replies, assignment cards and
reminders will eventually stop being deliverable. Encourage a periodic reply, or
plan a ZNS template as a follow-up.

### 5.5 Attachments

Employees’ photos arrive as Zalo CDN URLs and are stored as-is in
`task_attachment.url`; `next.config.ts` allows the `*.zadn.vn`, `*.zdn.vn` and
`*.zaloapp.com` hosts. The portal has no upload from the manager side.

### 5.6 Quotas and rate limits

Check remaining quota per user with
`GET https://openapi.zalo.me/v3.0/oa/quota/message?data={"user_id":…}`.
OA quality/reporting in OA Manager also affects limits.

---

## 6. Troubleshooting

| Symptom | Likely cause / fix |
| ------- | ------------------ |
| Webhook always `401 {"error":"bad signature"}` | Wrong `ZALO_OA_SECRET` (must be the OA secret, not App Secret), or a proxy rewrites the raw body. Our route reads `req.text()` before parsing — keep middleware from consuming it. |
| Webhook returns 200 but nothing happens | The event is not subscribed. Unlinked users are treated as customers: one auto-reply, then silence (see `[zalo:client]` logs). |
| `Zalo send failed (…): <code> <message>` in `zalo_message_log.error` | See Zalo’s error code: `-124` usually means the user is not reachable (blocked / outside the 7-day window) or over quota. |
| `Zalo OA not initialised` | `ZALO_OA_REFRESH_TOKEN` missing and no `zalo_oa_token` row. Re-run §3.E. |
| `Zalo token refresh failed: invalid refresh token` | Refresh token was already used/expired. Re-run §3.E and clear the row (see §5.1). |
| Button tap does nothing | Buttons are sent as `oa.query.hide`; the tap arrives as `user_send_text`. If payloads are missing, confirm the card was actually delivered and the task still belongs to that employee. |
| Employee taps a button several times and gets a wall of replies | Only the first tap is applied. Identical taps within 10 s are ignored, and a tap whose action already took effect (e.g. “Bắt đầu” on a task that is already *Đang làm*) is answered silently — no more “công việc đã kết thúc” spam. |
| `error=-201 … Missing template_type params` | The card used an unsupported `template_type`. Zalo's CS button format is `message.text` + `message.attachment.payload.buttons` with no `template_type` (see `client-real.ts#sendButtons`). |
| `user_submit_info` never arrives | Subscribe the event if you want shared contact details logged for the customer inbox. It is no longer used for linking. |
| Assign works but the employee gets no Zalo card | The assignee has no `zaloUserId` (status *Chờ kết nối*), or the 7-day window/send failed — check the log. |
| Duplicate “task done” events | Should not happen (dedupe on `msg_id`); if it does, check that `zalo_message_log.external_id` is unique and populated. |
| `error=-224 … upgrade OA Tier Package` | The OA's Zalo package does not allow button/template messages. Upgrade the OA tier in OA Manager. The task timeline marks the message as *Gửi Zalo thất bại*. |

---

## 7. Security notes

- The webhook **fails closed**: `live` without `ZALO_APP_ID`/`ZALO_OA_SECRET`
  rejects everything.
- Secrets belong in the platform secret manager; `.env*` is gitignored.
- Rotate `ZALO_APP_SECRET` / `ZALO_OA_SECRET` in Zalo, then update the env and
  redeploy (rotating the app secret invalidates tokens — expect one re-auth).
- Never expose tokens via the portal; the portal only shows the Zalo user id.
- `AUTH_BYPASS` and the simulator are structurally disabled in production.
- Revoking access: remove the app from the OA (OA Manager → ứng dụng) and unset
  the secrets; the portal keeps working (only Zalo notifications stop).

---

## 8. Pre-deploy checklist (all parts)

**Database**

- [ ] Hosted Postgres reachable with SSL; `DATABASE_URL` set.
- [ ] `pnpm db:migrate` applied on the production database (includes migration
      `0001` that cleans invalid/duplicate phones before adding the unique index).
- [ ] Backups enabled.

**Auth**

- [ ] `BETTER_AUTH_SECRET` (32+ chars) and `BETTER_AUTH_URL`/`NEXT_PUBLIC_APP_URL`
      set to the public HTTPS origin.
- [ ] Google OAuth client redirect URI = `https://<domain>/api/auth/callback/google`.
- [ ] `ALLOWED_MANAGER_EMAILS` **non-empty** in production.
- [ ] `AUTH_BYPASS=false`; `SKIP_ENV_VALIDATION` unset.

**App**

- [ ] `pnpm build` green; `pnpm test` (unit) and `pnpm test:e2e` green against a
      staging database.
- [ ] `/api/zalo/webhook` publicly reachable over HTTPS.
- [ ] Cron scheduler hitting `/api/cron/reminders` hourly with `CRON_SECRET`.

**Zalo**

- [ ] App created + Official Account API enabled, OA linked and permissions granted (§3.A–B).
- [ ] `ZALO_APP_ID`, `ZALO_APP_SECRET`, `ZALO_OA_SECRET` set; `ZALO_TRANSPORT=live`.
- [ ] Webhook URL + 5 events configured against the production domain (§3.D).
- [ ] Fresh `ZALO_OA_REFRESH_TOKEN` in the env (first deploy only) (§3.E).
- [ ] Smoke test §3.G passed with a real phone (both the employee invite-code
      link and the customer auto-reply).

---

## 9. Appendix

### Signature formula (implemented in `src/lib/zalo/signature.ts`)

```
X-ZEvent-Signature: mac=sha256(AppID + rawBody + timestamp + OA_Secret_Key)
timestamp = JSON body "timestamp" field (milliseconds)
```

### Token lifetimes

| Item | Lifetime | Notes |
| ---- | -------- | ----- |
| Authorization code | 10 min, single use | PKCE `code_verifier` required |
| Access token | 25 h | refreshed 5 min before expiry |
| Refresh token | 3 months, single use | new one returned on every refresh |

### Useful links

- Zalo for Developers: <https://developers.zalo.me>
- OA Manager: <https://oa.zalo.me>
- OAuth v4 (authorize): `https://oauth.zaloapp.com/v4/oa/permission`
- OAuth v4 (token): `https://oauth.zaloapp.com/v4/oa/access_token`
- Send CS message: `https://openapi.zalo.me/v3.0/oa/message/cs`
- User detail: `https://openapi.zalo.me/v3.0/oa/user/detail`
- Quota check: `https://openapi.zalo.me/v3.0/oa/quota/message`
