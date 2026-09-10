@AGENTS.md

# Đời Sống Xanh — conventions for AI agents

Read `AGENTS.md` first: this is Next.js 16, and its APIs differ from older
versions (async `params`/`searchParams`/`cookies()`/`headers()`, `middleware`
renamed to `proxy`, `next lint` removed). When unsure, read
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
- **Portal auth**: server components/actions call `requireUser()` /
  `requireAdmin()` from `src/lib/session.ts`. `proxy.ts` is only an optimistic
  cookie check — never rely on it for authorization.
- **Env**: import from `src/env.ts`, never `process.env` directly. Add new vars
  there (server vs client) and to `.env.example`.

## Adding things

- **New task status**: add to `taskStatus` enum in `src/db/schema/enums.ts`,
  labels + tone in `src/lib/labels.ts`, `pnpm db:generate`, wire the transition
  in `task-service.ts`.
- **New Zalo inbound event**: extend `InboundEvent` + `parseZaloWebhook`
  (`src/lib/zalo/parse.ts`), handle it in `dispatch.ts`, add logic in
  `conversation.ts`.
- **New portal page**: under `src/app/(portal)/`, start with `requireUser()`,
  read via `src/lib/queries.ts`, mutate via a server action in
  `src/lib/actions/`, then `revalidatePath`.
- After schema changes run `pnpm db:generate` and commit the SQL in
  `src/db/migrations/`.

## Before you finish

`pnpm typecheck && pnpm lint && pnpm test && pnpm build` must all pass.
For Zalo work, verify the loop through the `/settings/zalo` simulator (mock
transport) or `curl` against `POST /api/dev/zalo-inbound`.
