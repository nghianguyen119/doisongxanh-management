import type {
  SendResult,
  ZaloButton,
  ZaloProfile,
} from "./types";

/**
 * Transport-agnostic Zalo OA client. Two implementations exist:
 *  - client-mock.ts   (ZALO_TRANSPORT=mock) — logs to DB, no network
 *  - client-real.ts   (ZALO_TRANSPORT=live) — Zalo OA Open API v3.0
 * Resolve one with `getZaloClient()` from ./factory.
 */
export interface ZaloClient {
  readonly transport: "mock" | "live";

  sendText(zaloUserId: string, text: string): Promise<SendResult>;

  sendButtons(
    zaloUserId: string,
    text: string,
    buttons: ZaloButton[],
  ): Promise<SendResult>;

  /** Ask the user to share their name + phone (Zalo `request_user_info`). */
  requestUserInfo(
    zaloUserId: string,
    text: string,
  ): Promise<SendResult>;

  getUserProfile(zaloUserId: string): Promise<ZaloProfile | null>;
}
