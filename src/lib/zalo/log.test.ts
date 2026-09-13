import { describe, expect, it } from "vitest";
import { describeInbound, describeSend } from "./log";

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
    expect(describeInbound("follow", {})).toBe("Theo dõi Zalo công ty");
    expect(describeInbound("unfollow", {})).toBe("Bỏ theo dõi Zalo công ty");
  });
});

describe("describeSend", () => {
  it("summarises a plain text message", () => {
    expect(describeSend({ message: { text: "Xin chào" } })).toBe(
      'text="Xin chào"',
    );
  });

  it("summarises a buttons card sent the Zalo OA way", () => {
    expect(
      describeSend({
        recipient: { user_id: "1" },
        message: {
          text: "Bạn có việc mới",
          attachment: {
            type: "template",
            payload: {
              buttons: [
                { type: "oa.query.hide", title: "▶️ Bắt đầu", payload: "a" },
                { type: "oa.query.hide", title: "⚠️ Báo sự cố", payload: "b" },
              ],
            },
          },
        },
      }),
    ).toBe('buttons="Bạn có việc mới" [▶️ Bắt đầu | ⚠️ Báo sự cố]');
  });

  it("summarises the request_user_info template", () => {
    expect(
      describeSend({
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "request_user_info",
              elements: [{ title: "Chia sẻ thông tin" }],
            },
          },
        },
      }),
    ).toBe('request_user_info title="Chia sẻ thông tin"');
  });
});
