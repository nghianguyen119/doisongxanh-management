import { eq } from "drizzle-orm";
import { db } from "@/db";
import { zaloConversation } from "@/db/schema";
import { getZaloClient } from "@/lib/zalo/factory";
import { preview } from "@/lib/zalo/log";
import { copy } from "./bot-copy";

/**
 * The OA also receives messages from customers. Anyone whose Zalo id is not on
 * an employee row is handled here: they get one neutral acknowledgement per
 * window (never an "you are not connected" notice) and their messages stay in
 * `zalo_message_log` for managers to read in the portal.
 */
const AUTO_REPLY_COOLDOWN_MS = 12 * 60 * 60 * 1000;

type ClientContext = { lastClientReplyAt?: string };

async function contextFor(zaloUserId: string): Promise<ClientContext> {
  const conv = await db.query.zaloConversation.findFirst({
    where: eq(zaloConversation.zaloUserId, zaloUserId),
  });
  return (conv?.context ?? {}) as ClientContext;
}

async function acknowledgedRecently(zaloUserId: string) {
  const { lastClientReplyAt } = await contextFor(zaloUserId);
  if (!lastClientReplyAt) return false;
  const at = new Date(lastClientReplyAt).getTime();
  return Number.isFinite(at) && Date.now() - at < AUTO_REPLY_COOLDOWN_MS;
}

async function autoReply(zaloUserId: string, text: string) {
  if (await acknowledgedRecently(zaloUserId)) {
    console.log(`[zalo:client] user=${zaloUserId} within ack window -> silent`);
    return;
  }
  await getZaloClient().sendText(zaloUserId, text);
  await db
    .insert(zaloConversation)
    .values({
      zaloUserId,
      state: "idle",
      context: { lastClientReplyAt: new Date().toISOString() },
    })
    .onConflictDoUpdate({
      target: zaloConversation.zaloUserId,
      set: {
        state: "idle",
        context: { lastClientReplyAt: new Date().toISOString() },
        updatedAt: new Date(),
      },
    });
}

export async function handleClientText(zaloUserId: string, text: string) {
  console.log(
    `[zalo:client] text from=${zaloUserId} text="${preview(text)}" -> auto-reply`,
  );
  return autoReply(zaloUserId, copy.clientAutoReply);
}

export async function handleClientImage(zaloUserId: string, urls: string[]) {
  console.log(
    `[zalo:client] image from=${zaloUserId} files=${urls.length} -> auto-reply`,
  );
  return autoReply(zaloUserId, copy.clientImageAck);
}

export async function handleClientInfo(
  zaloUserId: string,
  info: { name?: string; phone?: string },
) {
  console.log(
    `[zalo:client] info from=${zaloUserId} name="${preview(info.name ?? "")}" ` +
      `phone="${preview(info.phone ?? "")}" -> auto-reply`,
  );
  return autoReply(zaloUserId, copy.clientInfoAck);
}
