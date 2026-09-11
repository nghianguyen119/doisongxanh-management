<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Đời Sống Xanh — conventions for AI agents

This is Next.js 16: its APIs differ from older versions (async
`params`/`searchParams`/`cookies()`/`headers()`, `middleware` renamed to
`proxy`, `next lint` removed). When unsure, read
`node_modules/next/dist/docs/`.

## Architecture rules

- **Zalo is a transport, not the domain.** Business logic lives in
  `src/lib/workflow/*` and must not import from `src/lib/zalo/client-real` or
  `client-mock` directly — always go through `getZaloClient()` in
  `src/lib/zalo/factory.ts`.
- **Every task mutation writes a `task_event`.** Add new lifecycle actions in
  `task-service.ts`, log an event, then call `notification-service.ts`. The
  portal timeline and dashboard read from `task_event`.
- **All employee-facing Vietnamese copy is in `src/lib/workflow/bot-copy.ts`.**
  Do not inline bot strings elsewhere.
- **Inbound Zalo events** (real webhook + mock simulator) both flow through
  `src/lib/zalo/dispatch.ts → src/lib/workflow/conversation.ts`. `dispatch`
  must never throw (Zalo retries non-200).
- **Buttons carry payloads**, not click events. `BUTTON_PAYLOAD` in
  `src/lib/zalo/types.ts` encodes `task:<action>:<taskId>`; a tap arrives as a
  normal text message whose text is that payload.
- **Zalo buttons never expire.** A message from weeks ago is still tappable, so
  every status change goes through the table in
  `src/lib/workflow/task-status.ts`. `transition()` in `task-service.ts` puts
  that check inside the `UPDATE ... WHERE status IN (...)`, which also makes
  concurrent taps safe. Never write `task.status` directly.
- **Mutations return a result, they do not throw.** `TaskResult` lets the Zalo
  handler answer the employee in Vietnamese; server actions convert `!ok` into
  an `Error` that `(portal)/error.tsx` renders.
- **Dates: always use `src/lib/time.ts`.** Never call date-fns `format()` on a
  raw Date and never `new Date("...T...")` a form value — both use the
  *server's* timezone, so a deadline typed as 14:30 becomes 21:30 in Vietnam on
  a UTC host. Use `formatVN` / `parseVNInput` / `toVNInputValue`. All timestamp
  columns are `timestamptz`.
- **Portal auth**: server components/actions call `requireUser()` /
  `requireAdmin()` from `src/lib/session.ts`. `proxy.ts` is only an optimistic
  cookie check — never rely on it for authorization. The manager allowlist is
  re-checked on every sign-in (`session.create.before` in `src/lib/auth.ts`),
  not just at account creation.
- **The webhook fails closed.** With `ZALO_TRANSPORT=live` a missing
  `ZALO_OA_SECRET` rejects every request; only `mock` skips signature checks.
  `/api/dev/zalo-inbound` additionally requires a non-production build.
- **Anything read from a query string is untrusted.** Validate before it
  reaches a Postgres enum/uuid column (see `parseTaskFilters` in
  `src/lib/queries.ts`) — otherwise a bad value is a 500, not a no-op.
- **Env**: import from `src/env.ts`, never `process.env` directly. Add new vars
  there (server vs client) and to `.env.example`.

## Adding things

- **New task status**: add to `taskStatus` enum in `src/db/schema/enums.ts`,
  labels + tone in `src/lib/labels.ts`, a row *and* the incoming edges in
  `TRANSITIONS` (`src/lib/workflow/task-status.ts`), then `pnpm db:generate`.
  The `Record<TaskStatus, …>` types make tsc point at everything you missed.
- **New Zalo inbound event**: extend `InboundEvent` + `parseZaloWebhook`
  (`src/lib/zalo/parse.ts`), handle it in `dispatch.ts`, add logic in
  `conversation.ts`.
- **New portal page**: under `src/app/(portal)/`, start with `requireUser()`,
  read via `src/lib/queries.ts`, mutate via a server action in
  `src/lib/actions/`, then `revalidatePath`.
- After schema changes run `pnpm db:generate` and commit the SQL in
  `src/db/migrations/`.

## Before you finish

For non-trivial changes, `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
must all pass. Small, low-risk edits (copy, constants, docs) do not need the
full suite — run `pnpm typecheck` at most. For Zalo work, verify the loop
through the `/settings/zalo` simulator (mock transport) or `curl` against
`POST /api/dev/zalo-inbound`.
