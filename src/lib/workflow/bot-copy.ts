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

export const BTN = {
  accept: (id: string): ZaloButton => ({
    title: "✅ Nhận việc",
    payload: BUTTON_PAYLOAD.encode("accept", id),
  }),
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
  // Linking
  followGreeting:
    "Chào mừng bạn đến với Đời Sống Xanh! 🌿\n" +
    "Vui lòng gửi MÃ MỜI (6 ký tự) mà quản lý đã cấp để kết nối tài khoản. " +
    "Hoặc nhấn nút bên dưới để chia sẻ số điện thoại.",
  askInviteCode: "Vui lòng nhập MÃ MỜI gồm 6 ký tự do quản lý cung cấp.",
  linkSuccess: (name: string) =>
    `Đã kết nối tài khoản cho ${name}. ✅ Bạn sẽ nhận công việc tại đây.`,
  linkNotFound:
    "Mã mời không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại với quản lý.",
  alreadyLinked:
    "Mã mời này đã được dùng cho một tài khoản Zalo khác. Vui lòng liên hệ quản lý.",
  phoneLinkSuccess: (name: string) =>
    `Đã xác minh số điện thoại và kết nối tài khoản cho ${name}. ✅`,
  phoneLinkNotFound:
    "Chưa tìm thấy nhân viên với số điện thoại này. Vui lòng liên hệ quản lý.",
  notLinkedHint:
    "Tài khoản Zalo của bạn chưa được kết nối. Vui lòng gửi MÃ MỜI do quản lý cấp.",
  shareInfoPrompt: "Chia sẻ tên và số điện thoại để kết nối tài khoản",

  // Assignment lifecycle
  assignedHeading: "🔔 Bạn có công việc mới:",
  updatedHeading: "✏️ Công việc vừa được cập nhật:",
  detailHeading: "ℹ️ Chi tiết công việc:",
  acceptedAck:
    "Đã ghi nhận bạn NHẬN việc. Nhấn “▶️ Bắt đầu” khi bạn khởi công.",
  startedAck: "Đã bắt đầu công việc. Chúc bạn làm việc thuận lợi! 💪",
  askDonePhoto:
    "Bạn hãy gửi 1 ảnh kết quả công việc. Hoặc gõ “bỏ qua” để hoàn tất không kèm ảnh.",
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
  stateExpired:
    "Đã quá lâu nên mình huỷ thao tác trước đó. Bạn hãy bấm lại nút trên tin nhắn công việc nhé.",

  managerComment: (text: string) => `💬 Quản lý: ${text}`,
  employeeCommentAck: "Đã chuyển lời nhắn của bạn tới quản lý. 📨",

  // Fallbacks
  noActiveTask:
    "Hiện bạn không có công việc nào đang mở. Khi có việc mới bạn sẽ nhận thông báo tại đây.",
  help:
    "Bạn có thể: gửi ảnh/nhắn tin để cập nhật công việc, hoặc chờ quản lý giao việc mới.",
  genericAck: "Đã nhận. ✅",
};
