import { db } from "@/db";
import { zaloMessageLog } from "@/db/schema";
import * as conversation from "@/lib/workflow/conversation";
import type { InboundEvent, RawZaloWebhook } from "./types";

/**
 * Single entry point for inbound Zalo events, used by both the real webhook
 * (src/app/api/zalo/webhook/route.ts) and the mock simulator
 * (src/app/api/dev/zalo-inbound/route.ts). Logs the event then routes it to
 * the workflow layer. Must never throw back to the caller — Zalo retries on
 * non-200 responses.
 */
export async function dispatchInbound(event: InboundEvent): Promise<void> {
  const externalId = messageIdOf(event);

  // Zalo re-delivers an event whenever a webhook call fails or times out.
  // The unique index on external_id makes the insert the idempotency check:
  // if nothing comes back we have already handled this exact message, so
  // drop it rather than completing the task (or posting the comment) twice.
  const [logged] = await db
    .insert(zaloMessageLog)
    .values({
      direction: "in",
      zaloUserId: event.zaloUserId,
      eventName: event.kind,
      externalId,
      payload: (event.raw ?? event) as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: zaloMessageLog.externalId })
    .returning({ id: zaloMessageLog.id });

  if (!logged) {
    console.warn("[zalo:dispatch] ignoring duplicate delivery", externalId);
    return;
  }

  try {
    switch (event.kind) {
      case "text":
        await conversation.handleInboundText(event.zaloUserId, event.text);
        break;
      case "image":
        await conversation.handleInboundImage(event.zaloUserId, event.imageUrls);
        break;
      case "follow":
        await conversation.handleFollow(event.zaloUserId);
        break;
      case "unfollow":
        await conversation.handleUnfollow(event.zaloUserId);
        break;
      case "user_info":
        await conversation.handleUserInfo(event.zaloUserId, {
          name: event.name,
          phone: event.phone,
        });
        break;
    }
  } catch (err) {
    console.error("[zalo:dispatch] handler error", event.kind, err);
    await db.insert(zaloMessageLog).values({
      direction: "in",
      zaloUserId: event.zaloUserId,
      eventName: `${event.kind}:error`,
      payload: { message: String(err) },
      error: String(err),
    });
  }
}

/**
 * Zalo's own message id, when the event carries one. Follow/unfollow events
 * do not, and neither do simulator-injected events; those get null, which the
 * unique index ignores (Postgres treats NULLs as distinct) so they are always
 * processed.
 */
function messageIdOf(event: InboundEvent): string | null {
  const raw = event.raw as RawZaloWebhook | undefined;
  return raw?.message?.msg_id ?? null;
}
