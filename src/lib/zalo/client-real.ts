import { db } from "@/db";
import { zaloMessageLog } from "@/db/schema";
import type { ZaloClient } from "./client";
import type { SendResult, ZaloButton, ZaloProfile } from "./types";
import { getAccessToken } from "./token-manager";

const SEND_URL = "https://openapi.zalo.me/v3.0/oa/message/cs";
const PROFILE_URL = "https://openapi.zalo.me/v3.0/oa/user/detail";

/**
 * Real Zalo OA Open API v3.0 transport.
 * Note the `/message/cs` endpoint is for replies inside the customer-service
 * interaction window. Messages outside that window need a ZNS template
 * (out of scope for this scaffold — see README).
 */
export class RealZaloClient implements ZaloClient {
  readonly transport = "live" as const;

  async sendText(zaloUserId: string, text: string): Promise<SendResult> {
    return this.post(zaloUserId, "text", {
      recipient: { user_id: zaloUserId },
      message: { text },
    });
  }

  async sendButtons(
    zaloUserId: string,
    text: string,
    buttons: ZaloButton[],
  ): Promise<SendResult> {
    return this.post(zaloUserId, "buttons", {
      recipient: { user_id: zaloUserId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text,
            buttons: buttons.map((b) => ({
              type: "oa.query.hide",
              title: b.title,
              payload: b.payload,
            })),
          },
        },
      },
    });
  }

  async requestUserInfo(
    zaloUserId: string,
    text: string,
  ): Promise<SendResult> {
    return this.post(zaloUserId, "request_user_info", {
      recipient: { user_id: zaloUserId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "request_user_info",
            elements: [
              {
                title: text,
                subtitle: "Nhấn để chia sẻ tên và số điện thoại",
                image_url: "",
              },
            ],
          },
        },
      },
    });
  }

  async getUserProfile(zaloUserId: string): Promise<ZaloProfile | null> {
    const token = await getAccessToken();
    const url = `${PROFILE_URL}?data=${encodeURIComponent(
      JSON.stringify({ user_id: zaloUserId }),
    )}`;
    const res = await fetch(url, { headers: { access_token: token } });
    const json = (await res.json()) as {
      data?: { display_name?: string; avatar?: string };
    };
    if (!json.data) return null;
    return {
      zaloUserId,
      name: json.data.display_name,
      avatar: json.data.avatar,
    };
  }

  private async post(
    zaloUserId: string,
    eventName: string,
    body: unknown,
  ): Promise<SendResult> {
    const token = await getAccessToken();
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: token,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      error?: number;
      message?: string;
      data?: { message_id?: string };
    };

    const ok = !json.error;
    await db.insert(zaloMessageLog).values({
      direction: "out",
      zaloUserId,
      eventName,
      payload: body as Record<string, unknown>,
      error: ok ? null : `${json.error}: ${json.message}`,
    });

    if (!ok) {
      throw new Error(`Zalo send failed (${eventName}): ${json.error} ${json.message}`);
    }
    return { messageId: json.data?.message_id ?? "unknown" };
  }
}
