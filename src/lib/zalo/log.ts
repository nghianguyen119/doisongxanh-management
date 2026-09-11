const MAX_PREVIEW = 400;

/** One-line, whitespace-collapsed, length-capped preview for logs. */
export function preview(value: unknown, max = MAX_PREVIEW): string {
  const text =
    typeof value === "string" ? value : JSON.stringify(value ?? "");
  const oneLine = (text ?? "").replace(/\s+/g, " ").trim();
  return oneLine.length > max
    ? `${oneLine.slice(0, max)}…(+${oneLine.length - max})`
    : oneLine;
}

interface InboundShape {
  kind?: string;
  text?: string;
  imageUrls?: string[];
  name?: string;
  phone?: string;
  message?: { text?: string; attachments?: { type?: string }[] };
  shared_info?: { name?: string; phone?: string };
  info?: { name?: string; phone?: string };
}

/**
 * Human summary of a logged inbound payload for the portal client inbox.
 * Handles both shapes found in `zalo_message_log`: the parsed `InboundEvent`
 * (mock simulator) and the raw Zalo webhook body (live).
 */
export function describeInbound(
  eventName: string | null,
  payload: unknown,
): string {
  const p = (payload ?? {}) as InboundShape;

  switch (eventName) {
    case "text":
      return preview(p.text ?? p.message?.text ?? "");
    case "image": {
      const count = p.imageUrls?.length ?? p.message?.attachments?.length ?? 0;
      return `[${count} hình ảnh]`;
    }
    case "user_info": {
      const info = p.shared_info ?? p.info;
      return [
        "Thông tin đã chia sẻ",
        p.name ?? info?.name,
        p.phone ?? info?.phone,
      ]
        .filter(Boolean)
        .join(" • ");
    }
    case "follow":
      return "Theo dõi OA";
    case "unfollow":
      return "Bỏ theo dõi OA";
    default:
      return preview(p);
  }
}

interface SendBodyShape {
  message?: {
    text?: string;
    attachment?: {
      payload?: {
        template_type?: string;
        text?: string;
        buttons?: { title?: string }[];
        elements?: { title?: string }[];
      };
    };
  };
}

/** Human summary of an outbound OA body: text / buttons / request_user_info. */
export function describeSend(body: unknown): string {
  const message = (body as SendBodyShape)?.message;
  if (!message) return "payload=?";

  if (message.text) return `text="${preview(message.text)}"`;

  const payload = message.attachment?.payload;
  if (!payload) return "payload=?";

  if (payload.template_type === "button") {
    const titles = (payload.buttons ?? [])
      .map((button) => button.title)
      .join(" | ");
    return `buttons="${preview(payload.text ?? "")}" [${titles}]`;
  }

  if (payload.template_type === "request_user_info") {
    return `request_user_info title="${preview(payload.elements?.[0]?.title ?? "")}"`;
  }

  return `attachment=${payload.template_type ?? "?"}`;
}
