import { db } from "@/db";
import { zaloMessageLog } from "@/db/schema";
import * as conversation from "@/lib/workflow/conversation";
import type { InboundEvent } from "./types";

/**
 * Single entry point for inbound Zalo events, used by both the real webhook
 * (src/app/api/zalo/webhook/route.ts) and the mock simulator
 * (src/app/api/dev/zalo-inbound/route.ts). Logs the event then routes it to
 * the workflow layer. Must never throw back to the caller — Zalo retries on
 * non-200 responses.
 */
export async function dispatchInbound(event: InboundEvent): Promise<void> {
  await db.insert(zaloMessageLog).values({
    direction: "in",
    zaloUserId: event.zaloUserId,
    eventName: event.kind,
    payload: (event.raw ?? event) as Record<string, unknown>,
  });

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
