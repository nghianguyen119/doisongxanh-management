import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { getAccessToken } from "@/lib/zalo/token-manager";

/**
 * Zalo OA capability tour. Sends one example of every 1-1 message feature the
 * CS API supports to a real user so a product owner can see what each looks
 * like on the phone.
 *
 *   pnpm exec tsx scripts/zalo-feature-tour.ts [zaloUserId] [stepFilter]
 *
 * Everything uses the access token stored in `zalo_oa_token`. The script never
 * prints the token. Features that need pre-approved templates (transaction,
 * promotion, ZBS) or a group/anonymous recipient are out of scope and are
 * called out in the final message instead.
 */

const ZALO_USER_ID = process.argv[2] ?? "7835813795861213745";
/** Optional substring filter, so a single failed step can be retried. */
const ONLY = process.argv[3] ?? "";
const CS_URL = "https://openapi.zalo.me/v3.0/oa/message/cs";
const V2_MESSAGE_URL = "https://openapi.zalo.me/v2.0/oa/message";
const UPLOAD_URL = "https://openapi.zalo.me/v2.0/oa/upload";
/** Public animated GIF (Wikimedia, 480x360). */
const SAMPLE_GIF =
  "https://upload.wikimedia.org/wikipedia/commons/d/d3/Newtons_cradle_animation_book_2.gif";
/** Public still image for list elements. */
const SAMPLE_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png";
const DEMO_PHONE = "84901234567";

type Json = Record<string, unknown>;

const results: string[] = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(url: string, body: Json): Promise<Json> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: token },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Json;
}

/** POST to /message/cs with a prebuilt `message` object. */
function cs(message: Json): Promise<Json> {
  return api(CS_URL, { recipient: { user_id: ZALO_USER_ID }, message });
}

async function post(url: string, body: Json): Promise<Json> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: token },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Json;
}

async function upload(
  path: "image" | "gif" | "file",
  filename: string,
  contentType: string,
  data: Buffer,
): Promise<Json> {
  const token = await getAccessToken();
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: contentType }), filename);
  const res = await fetch(`${UPLOAD_URL}/${path}`, {
    method: "POST",
    headers: { access_token: token },
    body: form,
  });
  return (await res.json()) as Json;
}

function dataOf(json: Json): Json {
  if (json.error) throw new Error(`${json.error} ${String(json.message)}`);
  return (json.data ?? {}) as Json;
}

function messageIdOf(json: Json): string {
  return String(dataOf(json).message_id ?? "ok");
}

async function step(name: string, run: () => Promise<string>) {
  if (ONLY && !name.includes(ONLY)) return;
  try {
    const detail = await run();
    results.push(`OK   ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    results.push(`FAIL ${name} — ${err instanceof Error ? err.message : err}`);
  }
  await sleep(700);
}

/** Minimal valid single-page PDF, good enough for Zalo's upload validator. */
function makePdf(text: string): Buffer {
  const stream = `BT /F1 14 Tf 20 100 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] " +
      "/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function lastInboundId(): Promise<string | null> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const row = await db.query<{ external_id: string | null }>(
      `select external_id from zalo_message_log
        where direction = 'in' and zalo_user_id = $1 and external_id is not null
        order by created_at desc limit 1`,
      [ZALO_USER_ID],
    );
    return row.rows[0]?.external_id ?? null;
  } finally {
    await db.end();
  }
}

async function main() {
  console.log(`Zalo feature tour -> ${ZALO_USER_ID}`);
  const lastId = await lastInboundId();

  // 1. Plain text.
  await step("text", async () =>
    messageIdOf(
      await cs({
        text:
          "🧪 Khảo sát Zalo công ty (1/10) — Tin văn bản thường.\n" +
          "Zalo không hỗ trợ in đậm/nghiêng/markdown; chỉ có xuống dòng, emoji và link trần.",
      }),
    ),
  );

  // 2. Four button action types in one card.
  await step("buttons (query.hide / query.show / open.url / open.phone)", async () =>
    messageIdOf(
      await cs({
        text:
          "(2/10) Bốn kiểu nút: ẩn (gửi ngầm), hiện (gửi lên khung chat), " +
          "mở link, gọi điện. Bấm thử từng nút.",
        attachment: {
          type: "template",
          payload: {
            buttons: [
              {
                title: "🔒 Nút ẩn (query.hide)",
                type: "oa.query.hide",
                payload: "demo:hide",
              },
              {
                title: "👁️ Nút hiện (query.show)",
                type: "oa.query.show",
                payload: "demo:show",
              },
              {
                title: "🌐 Mở link",
                type: "oa.open.url",
                payload: { url: "https://oa.zalo.me" },
              },
              {
                title: "📞 Gọi điện",
                type: "oa.open.phone",
                payload: { phone_code: DEMO_PHONE },
              },
            ],
          },
        },
      }),
    ),
  );

  // 3. SMS button.
  await step("buttons (open.sms)", async () =>
    messageIdOf(
      await cs({
        text: "(3/10) Nút mở SMS: mở ứng dụng tin nhắn với nội dung soạn sẵn.",
        attachment: {
          type: "template",
          payload: {
            buttons: [
              {
                title: "✉️ Mở SMS soạn sẵn",
                type: "oa.open.sms",
                payload: {
                  content: "Xin chào Đời Sống Xanh",
                  phone_code: DEMO_PHONE,
                },
              },
            ],
          },
        },
      }),
    ),
  );

  // 4. Quote reply.
  await step("quote reply", async () => {
    if (!lastId) throw new Error("no inbound message id to quote");
    return messageIdOf(
      await cs({
        text: "(4/10) Trả lời trích dẫn (quote) tin nhắn cuối cùng của bạn.",
        quote_message_id: lastId,
      }),
    );
  });

  // 5. Image: upload a local file then send by attachment_id with a caption.
  await step("image + caption (upload attachment_id)", async () => {
    const png = readFileSync(join(process.cwd(), "public", "logo.png"));
    const { attachment_id } = dataOf(
      await upload("image", "logo.png", "image/png", png),
    );
    return messageIdOf(
      await cs({
        text: "(5/10) Ảnh gửi kèm chú thích (upload lên Zalo rồi gửi bằng attachment_id).",
        attachment: {
          type: "template",
          payload: {
            template_type: "media",
            elements: [{ media_type: "image", attachment_id }],
          },
        },
      }),
    );
  });

  // 6. GIF: fetch a public animated gif, upload it, then send.
  await step("gif (upload + send)", async () => {
    const res = await fetch(SAMPLE_GIF, {
      headers: { "user-agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`gif download failed: HTTP ${res.status}`);
    const gif = Buffer.from(await res.arrayBuffer());
    const uploaded = dataOf(
      await upload("gif", "demo.gif", "image/gif", gif),
    );
    // Docs disagree on the field name (attachment_id vs token) — accept both.
    const attachmentId = (uploaded.attachment_id ?? uploaded.token) as
      | string
      | undefined;
    if (!attachmentId) {
      throw new Error(`gif upload returned no id: ${JSON.stringify(uploaded)}`);
    }
    return messageIdOf(
      await cs({
        text: "(6/10) Ảnh động GIF (tải GIF công khai, upload lên Zalo rồi gửi).",
        attachment: {
          type: "template",
          payload: {
            template_type: "media",
            elements: [
              {
                media_type: "gif",
                attachment_id: attachmentId,
                width: 480,
                height: 360,
              },
            ],
          },
        },
      }),
    );
  });

  // 7. File attachment: upload a PDF then send.
  await step("file (upload pdf + send)", async () => {
    const pdf = makePdf("Doi Song Xanh - vi du tep dinh kem");
    const { token } = dataOf(
      await upload("file", "vi-du.pdf", "application/pdf", pdf),
    );
    await cs({ text: "(7/10) Tệp đính kèm — bấm vào file PDF bên dưới." });
    return messageIdOf(
      await cs({ attachment: { type: "file", payload: { token } } }),
    );
  });

  // 8. Sticker (ids come from stickers.zaloapp.com).
  await step("sticker", async () => {
    await cs({ text: "(8/10) Sticker — Zalo công ty gửi sticker trực tiếp." });
    const ids = ["bfe458bf64fa8da4d4eb", "87521"];
    let lastError = "no sticker id";
    for (const id of ids) {
      const json = await cs({
        attachment: {
          type: "template",
          payload: {
            template_type: "media",
            elements: [{ media_type: "sticker", attachment_id: id }],
          },
        },
      });
      if (!json.error) return messageIdOf(json);
      lastError = `${json.error} ${String(json.message)} (id ${id})`;
    }
    throw new Error(lastError);
  });

  // 9. List template: elements + default actions + bottom buttons.
  await step("list template", async () => {
    await cs({
      text: "(9/10) Danh sách (list) có ảnh, hành động mặc định và nút — hợp làm menu.",
    });
    const json = await cs({
      attachment: {
        type: "template",
        payload: {
          template_type: "list",
          elements: [
            {
              title: "📋 Việc đang mở",
              subtitle: "Bấm để xem danh sách việc được giao",
              image_url: SAMPLE_IMAGE,
              default_action: { type: "oa.query.show", payload: "ds" },
            },
            {
              title: "📞 Gọi quản lý",
              subtitle: "Mở ứng dụng gọi điện",
              image_url: SAMPLE_IMAGE,
              default_action: {
                type: "oa.open.phone",
                payload: { phone_code: DEMO_PHONE },
              },
            },
          ],
          buttons: [
            {
              title: "ℹ️ Chi tiết",
              type: "oa.query.hide",
              payload: "demo:detail",
            },
          ],
        },
      },
    });
    if (json.error === -233) {
      throw new Error(
        "Zalo không còn hỗ trợ template list cho tin tư vấn (chỉ còn media/file/request_user_info)",
      );
    }
    return messageIdOf(json);
  });

  // 10. request_user_info.
  await step("request_user_info", async () => {
    await cs({ text: "(10/10) Thẻ xin thông tin người dùng (request_user_info)." });
    return messageIdOf(
      await cs({
        attachment: {
          type: "template",
          payload: {
            template_type: "request_user_info",
            elements: [
              {
                title: "Đời Sống Xanh muốn kết nối với bạn",
                subtitle: "Nhấn để chia sẻ tên và số điện thoại",
                image_url: "https://developers.zalo.me/web/static/zalo.png",
              },
            ],
          },
        },
      }),
    );
  });

  // 11. React to the user's own message (v2 sender_action, no quota used).
  await step("reaction on your last message", async () => {
    if (!lastId) throw new Error("no inbound message id to react to");
    const json = await post(V2_MESSAGE_URL, {
      recipient: { user_id: ZALO_USER_ID },
      sender_action: { react_icon: "/-heart", react_message_id: lastId },
    });
    if (json.error === -212) {
      throw new Error(
        "app chưa đăng ký API thả cảm xúc trong Zalo Developers",
      );
    }
    return messageIdOf(json);
  });

  await step("summary", async () =>
    messageIdOf(
      await cs({
        text:
          "✅ Hết khảo sát Zalo công ty.\n" +
          "Không áp dụng cho 1-1: tin giao dịch/quảng cáo & ZBS (cần template " +
          "đăng ký trước), broadcast, nhóm GMF, người dùng ẩn danh.\n" +
          "Các loại trên đây là toàn bộ thứ Zalo công ty có thể gửi cho một người.",
      }),
    ),
  );

  console.log("\n=== Kết quả ===");
  for (const line of results) console.log(line);
}

void main().then(() => process.exit(0));
