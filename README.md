# Đời Sống Xanh — Cổng quản lý công việc

Internal work-management system for **Đời Sống Xanh**. Managers assign and track
work from a small web portal; field employees receive assignments, accept work,
report completion (with photos) and raise issues entirely through the company
**Zalo Official Account** chat — no app, no login for them.

Think Trello/ClickUp where the *employee client* is Zalo.

## Stack

| Concern        | Choice                                             |
| -------------- | ------------------------------------------------- |
| Framework      | Next.js 16 (App Router, `src/`, Turbopack)         |
| DB             | PostgreSQL + Drizzle ORM (`drizzle-kit`)           |
| Auth           | Better Auth — Google OAuth only (managers)         |
| Styling        | Tailwind CSS v4                                    |
| Zalo           | `ZaloClient` interface + `mock` / `live` transport |
| Tests          | Vitest                                             |
| Package manager| pnpm                                               |

## Quick start (local, mock Zalo)

```bash
cp .env.example .env          # fill GOOGLE_CLIENT_ID/SECRET + ALLOWED_MANAGER_EMAILS
docker compose up -d db       # Postgres on :5432
pnpm install
pnpm db:migrate               # apply src/db/migrations
pnpm db:seed                  # demo manager + 3 employees + 2 tasks
pnpm dev                      # http://localhost:3000
```

Sign in at `/login` with a Google account whose email is in
`ALLOWED_MANAGER_EMAILS` (leave that var empty to allow any Google account during
first local setup). The first allowed user becomes `admin`.

With `ZALO_TRANSPORT=mock` (default) nothing hits the network. Go to
**Zalo OA → Mô phỏng Zalo** (`/settings/zalo`) to act as an employee's phone:
send text, images, follow/unfollow, share a phone number, and tap the buttons
the bot sends back.

### Try the whole loop (mock)

1. `/employees` → open **Trần Thị B** → **Tạo mã mời**. Copy the 6-char code.
2. `/settings/zalo` simulator → type the code as Zalo user `zalo-new-user` → the
   employee links and flips to *Đang hoạt động*.
3. `/tasks/new` → create a task, assign to **Nguyễn Văn A** → an outbound card
   with buttons appears in the simulator for `zalo-demo-1`.
4. Simulator: tap **✅ Nhận việc** → **▶️ Bắt đầu** → **✔️ Đã xong** → send an
   image. The task on `/tasks/[id]` moves `assigned → accepted → in_progress →
   done`, the timeline fills in and the photo shows in the gallery.
5. Tap **⚠️ Báo sự cố** then send text → task goes to *Gặp sự cố* with the note.

## Going live with a real Zalo OA

1. Create an app + Official Account at <https://developers.zalo.me>. Add the
   **Official Account API** product.
2. In the app's **Webhook** section: set the callback URL to
   `https://<your-domain>/api/zalo/webhook`, copy the **OA Secret Key**, and
   subscribe to at least: `user_send_text`, `user_send_image`, `follow`,
   `unfollow`, `user_submit_info`.
3. Do the OAuth flow once to obtain the initial **access token** + **refresh
   token** (access token lasts ~1h, refresh token ~3 months).
4. Set in `.env`:
   ```
   ZALO_TRANSPORT=live
   ZALO_APP_ID=...
   ZALO_APP_SECRET=...        # "secret key"
   ZALO_OA_SECRET=...         # "OA secret key" — used for webhook signature
   ZALO_OA_ACCESS_TOKEN=...   # bootstrap only
   ZALO_OA_REFRESH_TOKEN=...  # bootstrap only
   ```
   After the first refresh the token pair is stored in the `zalo_oa_token` table
   and the env values are ignored.
5. Messages the OA can send for free are limited to the customer-service
   interaction window. Out-of-window messaging needs paid **ZNS templates** —
   not implemented here.

> The webhook **fails closed**: in `live` mode a missing `ZALO_OA_SECRET`
> rejects every request, because an unverified webhook would let anyone who
> knows an employee's Zalo id complete tasks on their behalf.

## Due-date reminders

`/api/cron/reminders` nudges employees whose open task is due within 2 hours or
already overdue, throttled to once per task per 12 hours. Set `CRON_SECRET` and
call it hourly from any scheduler:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/reminders
```

It is idempotent, so running it more often than needed is harmless. Leaving
`CRON_SECRET` unset disables the endpoint (503).

## Timezone

The company works in Vietnam, so every date shown (portal *and* Zalo bot) and
every deadline a manager types is `Asia/Ho_Chi_Minh`, independent of the
server's timezone — see [src/lib/time.ts](src/lib/time.ts). All timestamp
columns are `timestamptz`. Use `formatVN` / `parseVNInput` rather than calling
date-fns on a raw `Date`, or deadlines silently shift by 7 hours on a UTC host.

## Scripts

| Command            | What                                              |
| ------------------ | ------------------------------------------------ |
| `pnpm dev`         | Dev server (Turbopack)                            |
| `pnpm build`       | Production build                                  |
| `pnpm typecheck`   | `tsc --noEmit`                                    |
| `pnpm lint`        | ESLint                                            |
| `pnpm test`        | Vitest                                            |
| `pnpm db:generate` | Generate a migration from schema changes          |
| `pnpm db:migrate`  | Apply migrations                                  |
| `pnpm db:push`     | Push schema without a migration (dev only)        |
| `pnpm db:studio`   | Drizzle Studio                                    |
| `pnpm db:seed`     | Seed demo data                                    |
| `pnpm db:reset`    | Drop schemas, re-migrate, re-seed (dev only)      |
| `pnpm auth:generate` | Regenerate `src/db/schema/auth.ts` from Better Auth options |

## Layout

```
src/
  app/
    (portal)/        manager UI — dashboard, tasks, employees, settings/zalo
    login/           Google sign-in
    api/auth/[...all] Better Auth handler
    api/zalo/webhook  real Zalo webhook (signature-verified)
    api/dev/zalo-inbound  mock-only simulator endpoint
  db/schema/         Drizzle tables (auth, employee, task, zalo) + enums
    api/cron/reminders    due-date nudges (Bearer CRON_SECRET)
  lib/
    auth.ts          Better Auth server (Google + email allowlist + role)
    session.ts       requireUser / requireAdmin for server components
    time.ts          Asia/Ho_Chi_Minh formatting + parsing (use this, not date-fns)
    zalo/            transport-agnostic client, mock + live adapters, parse, dispatch
    workflow/        Zalo-agnostic business logic
      task-service.ts        lifecycle mutations, each writes a task_event
      task-status.ts         legal transitions; guards stale Zalo buttons
      notification-service.ts Vietnamese Zalo messages per lifecycle change
      conversation.ts        inbound state machine (buttons, issue/done flows)
      employee-linking.ts    invite code / phone share / manual Zalo id
      bot-copy.ts            every VN string the bot sends
    actions/         server actions used by portal forms
    queries.ts       read helpers + query-string filter validation
  proxy.ts           Next 16 middleware (optimistic cookie gate)
```

See [CLAUDE.md](./CLAUDE.md) for conventions when extending the code.
