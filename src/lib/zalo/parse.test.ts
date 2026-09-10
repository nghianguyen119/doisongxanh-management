import { describe, expect, it } from "vitest";
import { parseZaloWebhook } from "./parse";

describe("parseZaloWebhook", () => {
  it("maps user_send_text", () => {
    expect(
      parseZaloWebhook({
        event_name: "user_send_text",
        sender: { id: "u1" },
        message: { text: "  hello  " },
      }),
    ).toMatchObject({ kind: "text", zaloUserId: "u1", text: "hello" });
  });

  it("maps user_send_image and keeps only image urls", () => {
    const event = parseZaloWebhook({
      event_name: "user_send_image",
      sender: { id: "u2" },
      message: {
        attachments: [
          { type: "image", payload: { url: "https://x/1.jpg" } },
          { type: "file", payload: { url: "https://x/other" } },
        ],
      },
    });
    expect(event).toMatchObject({ kind: "image", zaloUserId: "u2" });
    expect(event && "imageUrls" in event && event.imageUrls).toEqual([
      "https://x/1.jpg",
    ]);
  });

  it("maps follow / unfollow via follower id", () => {
    expect(
      parseZaloWebhook({ event_name: "follow", follower: { id: "u3" } }),
    ).toMatchObject({ kind: "follow", zaloUserId: "u3" });
  });

  it("maps user_submit_info", () => {
    expect(
      parseZaloWebhook({
        event_name: "user_submit_info",
        sender: { id: "u4" },
        shared_info: { name: "An", phone: "0900" },
      }),
    ).toMatchObject({ kind: "user_info", zaloUserId: "u4", phone: "0900" });
  });

  it("returns null for events we ignore or missing sender", () => {
    expect(parseZaloWebhook({ event_name: "user_seen_message" })).toBeNull();
    expect(
      parseZaloWebhook({ event_name: "user_send_text", message: { text: "hi" } }),
    ).toBeNull();
  });
});
