import { formatVN } from "@/lib/time";
import { BUTTON_PAYLOAD, type ZaloButton } from "@/lib/zalo/types";

/**
 * Every Vietnamese string the Zalo bot sends lives here so copy can be tuned
 * in one place. `task` is a minimal shape to avoid importing DB types.
 */
export interface TaskCardInput {
  id: string;
  title: string;
  description?: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  dueAt?: Date | null;
}

const PRIORITY_LABEL: Record<TaskCardInput["priority"], string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
  urgent: "Khẩn",
};

function fmtDue(due?: Date | null) {
  // Always Vietnam wall time — the employee reading this is in Vietnam even
  // when the server is not. See src/lib/time.ts.
  return due ? formatVN(due) : "Không có hạn";
}

export function taskCardText(t: TaskCardInput, heading: string): string {
  return [
    heading,
    "",
    `📋 ${t.title}`,
    t.description ? `📝 ${t.description}` : null,
    `⚡ Mức ưu tiên: ${PRIORITY_LABEL[t.priority]}`,
    `⏰ Hạn: ${fmtDue(t.dueAt)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface TaskListEntry {
  /** 1-based position inside the current page. */
  index: number;
  title: string;
  dueAt?: Date | null;
}

function shortTitle(title: string, max = 60) {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}

/** Numbered "which task?" message for an employee with several open tasks. */
export function taskPickText(
  entries: TaskListEntry[],
  { total, hasMore }: { total: number; hasMore: boolean },
): string {
  return [
    `📋 Bạn đang có ${total} việc đang mở. Trả lời SỐ để chọn việc:`,
    ...entries.map(
      (e) =>
        `${e.index}. ${shortTitle(e.title)}${e.dueAt ? ` (hạn ${fmtDue(e.dueAt)})` : ""}`,
    ),
    hasMore ? "…và còn việc khác, gõ “ds” để xem tiếp." : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export const BTN = {
  start: (id: string): ZaloButton => ({
    title: "▶️ Bắt đầu",
    payload: BUTTON_PAYLOAD.encode("start", id),
  }),
  done: (id: string): ZaloButton => ({
    title: "✔️ Đã xong",
    payload: BUTTON_PAYLOAD.encode("done", id),
  }),
  issue: (id: string): ZaloButton => ({
    title: "⚠️ Báo sự cố",
    payload: BUTTON_PAYLOAD.encode("issue", id),
  }),
  detail: (id: string): ZaloButton => ({
    title: "ℹ️ Chi tiết",
    payload: BUTTON_PAYLOAD.encode("detail", id),
  }),
};

export const copy = {
  // Linking (employees) — the OA also serves customers, see "Client" below.
  followGreeting:
    "Chào mừng bạn đến với Đời Sống Xanh! 🌿\n" +
    "• Nhân viên: gửi MÃ MỜI (4 chữ cái) do quản lý cấp để kết nối tài khoản.\n" +
    "• Khách hàng: để lại lời nhắn, chúng tôi sẽ phản hồi trong thời gian sớm nhất.",
  linkSuccess: (name: string) =>
    `Đã kết nối tài khoản cho ${name}. ✅ Bạn sẽ nhận công việc tại đây.`,
  /** Ready-to-paste invite the manager sends to the employee (or a group). */
  invite: (name: string, code: string) =>
    `Chào ${name} 🌿\n` +
    `Đời Sống Xanh đã tạo mã mời kết nối tài khoản Zalo để bạn nhận công việc.\n` +
    `Bạn hãy quan tâm OA Đời Sống Xanh rồi gửi mã: ${code} cho OA nhé.\n` +
    `Sau khi kết nối, công việc sẽ được gửi cho bạn qua Zalo.`,
  linkNotFound:
    "Mã mời không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại với quản lý.",
  alreadyLinked:
    "Mã mời này đã được dùng cho một tài khoản Zalo khác. Vui lòng liên hệ quản lý.",
  accountInactive:
    "Tài khoản của bạn đang tạm ngưng. Vui lòng liên hệ quản lý để mở lại.",
  /** Sent right after an employee links, before their practice task. */
  onboardingGuide:
    "🌿 Hướng dẫn nhận việc qua Zalo:\n" +
    "• Khi có việc, bạn nhận thẻ công việc tại đây.\n" +
    "• Bấm ▶️ Bắt đầu khi khởi công, ✔️ Đã xong khi làm xong, ⚠️ Báo sự cố khi " +
    "vướng mắc, ℹ️ Chi tiết để xem lại.\n" +
    "• Muốn kèm ảnh/ghi chú, bạn gửi ảnh/ghi chú cho OA trước khi bấm Đã xong.\n" +
    "• Cứ thoải mái thử với việc làm quen bên dưới — không ảnh hưởng công việc thật.",

  // Client (any Zalo user not linked to an employee)
  clientAutoReply:
    "Cảm ơn bạn đã liên hệ Đời Sống Xanh. 🌿 Chúng tôi đã nhận được tin nhắn " +
    "và sẽ phản hồi trong thời gian sớm nhất.",
  clientImageAck:
    "Đã nhận được hình ảnh. Chúng tôi sẽ kiểm tra và phản hồi sớm nhất. 🌿",
  clientInfoAck:
    "Cảm ơn bạn đã chia sẻ thông tin. Chúng tôi sẽ liên hệ với bạn sớm nhất. 🌿",

  // Assignment lifecycle
  assignedHeading: "🔔 Bạn có công việc mới:",
  updatedHeading: "✏️ Công việc vừa được cập nhật:",
  detailHeading: "ℹ️ Chi tiết công việc:",
  startedAck: "Đã bắt đầu công việc. Chúc bạn làm việc thuận lợi! 💪",
  doneAck:
    "Cảm ơn bạn! ✔️ Công việc đã được báo hoàn thành. Quản lý sẽ kiểm tra và xác nhận.",
  askIssueText: "Bạn đang gặp vấn đề gì? Hãy nhập mô tả ngắn gọn.",
  issueAck: "Đã gửi báo cáo sự cố cho quản lý. ⚠️ Vui lòng chờ phản hồi.",
  verifiedNotice: "Công việc của bạn đã được xác nhận HOÀN THÀNH. Cảm ơn bạn! 🎉",
  cancelledNotice: "Công việc đã được HUỶ bởi quản lý.",
  reminderDue: (title: string) => `⏰ Nhắc việc: “${title}” sắp đến hạn.`,
  reminderOverdue: (title: string) =>
    `🔴 Công việc “${title}” đã QUÁ HẠN. Vui lòng cập nhật giúp quản lý.`,

  /** A stale Zalo button from an already-closed task was tapped. */
  taskClosed:
    "Công việc này đã kết thúc nên không cập nhật được nữa. Nếu cần, vui lòng báo quản lý.",
  taskNotYours: "Công việc này hiện không thuộc về bạn.",

  managerComment: (text: string) => `💬 Quản lý: ${text}`,
  commentAck: (title: string) => `Đã ghi nhận vào việc “${title}”. 📨`,

  // Choosing between several open tasks
  taskPickInvalid:
    "Mình chưa hiểu. Vui lòng trả lời bằng SỐ trong danh sách (ví dụ: 2).",
  taskPickImageHeld:
    "Đã nhận ảnh. Vui lòng trả lời SỐ trong danh sách để chọn việc cho ảnh này.",
  taskPicked: (title: string) =>
    `Đã chọn việc “${title}”. Bạn nhắn tiếp ở đây nhé.`,
  onlyOneTask: (title: string) =>
    `Bạn chỉ có 1 việc đang mở: “${title}”. Cứ nhắn ở đây để cập nhật.`,

  // Fallbacks
  noActiveTask:
    "Hiện bạn không có công việc nào đang mở. Khi có việc mới bạn sẽ nhận thông báo tại đây.",
  help:
    "Bạn có thể: nhắn tin/gửi ảnh để cập nhật việc, gõ “ds” để xem danh sách " +
    "việc đang mở, hoặc bấm nút trên thẻ công việc.",
  genericAck: "Đã nhận. ✅",

  /** Title of the Zalo `request_user_info` card (sent from the tester). */
  requestInfoTitle: "Đời Sống Xanh muốn kết nối với bạn",
};

/** First task every linked employee gets so they can try the buttons safely. */
export const ONBOARDING_TASK = {
  title: "🌱 Việc làm quen: thử các nút Bắt đầu / Đã xong / Báo sự cố",
  description:
    "Đây là việc thử để bạn làm quen hệ thống, không ảnh hưởng công việc thật. " +
    "Bạn cứ bấm ▶️ Bắt đầu, gửi ảnh/ghi chú, rồi ✔️ Đã xong — hoặc ⚠️ Báo sự cố.",
} as const;
