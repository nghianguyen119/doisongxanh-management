import type { InboundEvent, RawZaloWebhook } from "./types";

/**
 * Map a raw Zalo OA webhook body to our normalised InboundEvent, or null for
 * events we don't act on (delivery receipts, seen, sticker, ...).
 */
export function parseZaloWebhook(raw: RawZaloWebhook): InboundEvent | null {
  const event = raw.event_name;
  const senderId = raw.sender?.id ?? raw.follower?.id ?? raw.user_id;
  if (!senderId) return null;

  switch (event) {
    case "user_send_text": {
      const text = raw.message?.text?.trim();
      if (!text) return null;
      return { kind: "text", zaloUserId: senderId, text, raw };
    }
    case "user_send_image": {
      const urls = (raw.message?.attachments ?? [])
        .filter((a) => a.type === "image")
        .map((a) => a.payload?.url)
        .filter((u): u is string => Boolean(u));
      if (urls.length === 0) return null;
      return { kind: "image", zaloUserId: senderId, imageUrls: urls, raw };
    }
    case "follow":
      return { kind: "follow", zaloUserId: senderId, raw };
    case "unfollow":
      return { kind: "unfollow", zaloUserId: senderId, raw };
    case "user_submit_info": {
      const info = raw.shared_info ?? raw.info ?? {};
      return {
        kind: "user_info",
        zaloUserId: senderId,
        name: info.name,
        phone: info.phone,
        raw,
      };
    }
    default:
      return null;
  }
}
