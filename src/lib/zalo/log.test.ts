import { describe, expect, it } from "vitest";
import { describeInbound } from "./log";

describe("describeInbound", () => {
  it("reads text from the parsed event and the raw webhook", () => {
    expect(describeInbound("text", { kind: "text", text: "Xin chào" })).toBe(
      "Xin chào",
    );
    expect(
      describeInbound("text", {
        event_name: "user_send_text",
        message: { text: "Tư vấn" },
      }),
    ).toBe("Tư vấn");
  });

  it("counts images from both shapes", () => {
    expect(describeInbound("image", { imageUrls: ["a", "b"] })).toBe(
      "[2 hình ảnh]",
    );
    expect(
      describeInbound("image", {
        message: { attachments: [{ type: "image" }] },
      }),
    ).toBe("[1 hình ảnh]");
  });

  it("summarises shared contact info", () => {
    expect(
      describeInbound("user_info", {
        shared_info: { name: "Lan", phone: "0912345678" },
      }),
    ).toBe("Thông tin đã chia sẻ • Lan • 0912345678");
  });

  it("labels follow and unfollow", () => {
    expect(describeInbound("follow", {})).toBe("Theo dõi OA");
    expect(describeInbound("unfollow", {})).toBe("Bỏ theo dõi OA");
  });
});
