/**
 * Zalo OA integration types.
 *
 * We normalise the many raw Zalo webhook `event_name`s into a small
 * `InboundEvent` union that the rest of the app works with. Interactive
 * buttons in Zalo OA do not produce a dedicated event: a tap on an
 * `oa.query.hide` button sends the button's `payload` back as a normal text
 * message, so button taps arrive here as `kind: "text"` whose `text` is the
 * payload string (e.g. `task:start:<uuid>`). See BUTTON_PAYLOAD below.
 */

export type InboundEvent =
  | { kind: "text"; zaloUserId: string; text: string; raw?: unknown }
  | { kind: "image"; zaloUserId: string; imageUrls: string[]; raw?: unknown }
  | { kind: "follow"; zaloUserId: string; raw?: unknown }
  | { kind: "unfollow"; zaloUserId: string; raw?: unknown }
  | {
      kind: "user_info";
      zaloUserId: string;
      phone?: string;
      name?: string;
      raw?: unknown;
    };

/** A payload-style button (Zalo type `oa.query.hide`). */
export interface ZaloButton {
  title: string;
  payload: string;
}

export interface SendResult {
  messageId: string;
}

export interface ZaloProfile {
  zaloUserId: string;
  name?: string;
  avatar?: string;
}

/** Compact button payload helpers: `task:<action>:<taskId>` */
export const BUTTON_PAYLOAD = {
  encode: (action: string, taskId: string) => `task:${action}:${taskId}`,
  decode: (
    text: string,
  ): { action: string; taskId: string } | null => {
    const m = /^task:([a-z_]+):([0-9a-fA-F-]{36})$/.exec(text.trim());
    return m ? { action: m[1], taskId: m[2] } : null;
  },
};

/**
 * Task-less button commands. Unlike `task:*` payloads these work from any
 * conversation state, so they must not collide with typed messages.
 */
export const COMMAND_PAYLOAD = {
  myTasks: "cmd:my_tasks",
} as const;

// ---------------------------------------------------------------------------
// Raw Zalo webhook shapes (partial — only the fields we read).
// Docs: https://developers.zalo.me/docs/api/official-account-api/webhook
// ---------------------------------------------------------------------------
export interface RawZaloWebhook {
  app_id?: string;
  event_name?: string;
  timestamp?: string;
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: {
    msg_id?: string;
    text?: string;
    attachments?: Array<{
      type?: string;
      payload?: { url?: string; thumbnail?: string };
    }>;
  };
  follower?: { id?: string };
  user_id?: string;
  info?: { name?: string; phone?: string };
  shared_info?: { name?: string; phone?: string };
}
