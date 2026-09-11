import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employee, zaloMessageLog } from "@/db/schema";
import type { ZaloClient } from "./client";
import { preview } from "./log";
import type { SendResult, ZaloButton, ZaloProfile } from "./types";

/**
 * Mock transport: no network. Outbound messages are written to
 * `zalo_message_log` (direction=out) which the /settings/zalo simulator
 * renders as the "employee's phone". Inbound events are injected via
 * POST /api/dev/zalo-inbound.
 */
export class MockZaloClient implements ZaloClient {
  readonly transport = "mock" as const;

  async sendText(zaloUserId: string, text: string): Promise<SendResult> {
    return this.log(zaloUserId, "text", { text });
  }

  async sendButtons(
    zaloUserId: string,
    text: string,
    buttons: ZaloButton[],
  ): Promise<SendResult> {
    return this.log(zaloUserId, "buttons", { text, buttons });
  }

  async requestUserInfo(
    zaloUserId: string,
    text: string,
  ): Promise<SendResult> {
    return this.log(zaloUserId, "request_user_info", { text });
  }

  async getUserProfile(zaloUserId: string): Promise<ZaloProfile | null> {
    const emp = await db.query.employee.findFirst({
      where: eq(employee.zaloUserId, zaloUserId),
    });
    return {
      zaloUserId,
      name: emp?.zaloDisplayName ?? emp?.name ?? `Zalo ${zaloUserId}`,
    };
  }

  private async log(
    zaloUserId: string,
    eventName: string,
    payload: Record<string, unknown>,
  ): Promise<SendResult> {
    const [row] = await db
      .insert(zaloMessageLog)
      .values({ direction: "out", zaloUserId, eventName, payload })
      .returning({ id: zaloMessageLog.id });
    console.log(
      `[zalo:send] <- mock ${eventName} to=${zaloUserId} payload=${preview(payload)}`,
    );
    return { messageId: row.id };
  }
}

