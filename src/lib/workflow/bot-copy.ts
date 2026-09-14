import { formatVN } from "@/lib/time";
import { BUTTON_PAYLOAD, COMMAND_PAYLOAD, type ZaloButton } from "@/lib/zalo/types";

/**
 * Every Vietnamese string the Zalo bot sends lives here so copy can be tuned
 * in one place. `task` is a minimal shape to avoid importing DB types.
 */

/** Public link to the company Zalo account employees must follow. */
export const ZALO_COMPANY_URL = "https://zalo.me/3275241228585114260";

export interface TaskCardInput {
  id: string;
  /** Human-facing reference, e.g. `DSX-12`. */
  ref: string;
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
  return due ? formatVN(due) : "Không có";
}

/** Anything that can be named in a message: `DSX-12 · Tưới cây sảnh`. */
export interface TaskLabelInput {
  ref: string;
  title: string;
}

export interface NoticeCopy {
  heading: string;
  closing?: string;
}

/**
 * Full task card (assignment / update / reminder): heading, reference + title,
 * priority, due date, optional description and closing line.
 */
export function taskCardText(t: TaskCardInput, notice: NoticeCopy): string {
  const lines = [
    notice.heading,
    "",
    `${t.ref} · ${t.title}`,
    `Ưu tiên: ${PRIORITY_LABEL[t.priority]}`,
    `Hạn hoàn thành: ${fmtDue(t.dueAt)}`,
  ];
  if (t.description) lines.push("", `Mô tả: ${t.description}`);
  if (notice.closing) lines.push("", notice.closing);
  return lines.join("\n");
}

/** Short lifecycle notice: heading, reference + title, optional closing line. */
export function taskNoticeText(t: TaskLabelInput, notice: NoticeCopy): string {
  const lines = [notice.heading, "", `${t.ref} · ${t.title}`];
  if (notice.closing) lines.push("", notice.closing);
  return lines.join("\n");
}

function shortTitle(title: string, max = 60) {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}

/** `“Task title” ` when known, empty otherwise (stale/no-task fallbacks). */
function named(title?: string) {
  return title ? `“${title}” ` : "";
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
  /** Makes this task the active one and asks for a progress update. */
  progress: (id: string): ZaloButton => ({
    title: "📝 Báo cáo tiến độ",
    payload: BUTTON_PAYLOAD.encode("progress", id),
  }),
  /** Opens the button menu of every open task; works from any state. */
  myTasks: (): ZaloButton => ({
    title: "📋 Việc của tôi",
    payload: COMMAND_PAYLOAD.myTasks,
  }),
  /** One task in the "which task?" menu; title is the task's own name. */
  pick: (id: string, title: string, ref?: string): ZaloButton => ({
    title: shortTitle(ref ? `${ref} · ${title}` : title, 30),
    payload: BUTTON_PAYLOAD.encode("pick", id),
  }),
  /** Next page of the menu. The plain "ds" command keeps old code paths. */
  more: (): ZaloButton => ({
    title: "⬇️ Xem thêm",
    payload: "ds",
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
    `1. Mở Zalo công ty tại: ${ZALO_COMPANY_URL}\n` +
    `2. Bấm "Quan tâm" rồi gửi mã: ${code}\n` +
    `Sau khi kết nối, công việc sẽ được gửi cho bạn qua Zalo.`,
  linkNotFound:
    "Mã mời không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại với quản lý.",
  alreadyLinked:
    "Mã mời này đã được dùng cho một tài khoản Zalo khác. Vui lòng liên hệ quản lý.",
  accountInactive:
    "Tài khoản của bạn đang tạm ngưng. Vui lòng liên hệ quản lý để mở lại.",
  /** Sent right after an employee links, before their practice task. */
  onboardingGuide:
    "🌿 Hướng dẫn nhận việc qua Zalo\n" +
    "\n" +
    "• Công việc mới sẽ hiện thành thẻ tại đây.\n" +
    "• Bấm ▶️ Bắt đầu khi khởi công, ✔️ Đã xong khi hoàn thành, ⚠️ Báo sự cố khi vướng mắc.\n" +
    "• Bấm 📋 Việc của tôi để xem và đổi việc đang trao đổi.\n" +
    "• Gửi ảnh/ghi chú trước khi bấm Đã xong để đính kèm vào công việc.\n" +
    "• Việc làm quen bên dưới để bạn thử — không ảnh hưởng công việc thật.",

  // Client (any Zalo user not linked to an employee)
  clientAutoReply:
    "Cảm ơn bạn đã liên hệ Đời Sống Xanh. 🌿 Chúng tôi đã nhận được tin nhắn " +
    "và sẽ phản hồi trong thời gian sớm nhất.",
  clientImageAck:
    "Đã nhận được hình ảnh. Chúng tôi sẽ kiểm tra và phản hồi sớm nhất. 🌿",
  clientInfoAck:
    "Cảm ơn bạn đã chia sẻ thông tin. Chúng tôi sẽ liên hệ với bạn sớm nhất. 🌿",

  // Assignment lifecycle
  assignedHeading: "📌 Công việc mới được giao",
  assignedClosing:
    "Vui lòng kiểm tra chi tiết công việc và cập nhật trạng thái khi hoàn thành.",
  updatedHeading: "✏️ Công việc vừa được cập nhật",
  updatedClosing: "Vui lòng kiểm tra lại thông tin công việc.",
  startedHeading: "▶️ Đã bắt đầu công việc",
  startedClosing: "Chúc bạn làm việc thuận lợi! 💪",
  doneHeading: "✅ Đã báo hoàn thành",
  doneClosing: "Cảm ơn bạn! Quản lý sẽ kiểm tra và xác nhận.",
  issueHeading: "⚠️ Báo sự cố",
  issueClosing: "Bạn đang gặp vấn đề gì? Hãy nhập mô tả ngắn gọn.",
  issueAckHeading: "⚠️ Đã ghi nhận sự cố",
  issueAckClosing: "Quản lý sẽ xem và phản hồi sớm. Vui lòng chờ phản hồi.",
  verifiedHeading: "🎉 Công việc đã hoàn thành",
  verifiedClosing: "Quản lý đã xác nhận. Cảm ơn bạn!",
  cancelledHeading: "🚫 Công việc đã huỷ",
  cancelledClosing: "Quản lý đã huỷ công việc này.",
  reminderDueHeading: "⏰ Công việc sắp đến hạn",
  reminderOverdueHeading: "🔴 Công việc đã quá hạn",
  reminderClosing: "Vui lòng cập nhật tiến độ giúp quản lý.",

  /** A stale Zalo button from an already-closed task was tapped. */
  taskClosed: (label?: string) =>
    `Công việc ${named(label)}đã kết thúc nên không cập nhật được nữa. Nếu cần, vui lòng báo quản lý.`,
  taskNotYours: "Công việc này hiện không thuộc về bạn.",
  /** The task moved while the tap was in flight; ask for a fresh look. */
  taskStateChanged: (label?: string) =>
    `Công việc ${named(label)}vừa thay đổi trạng thái. Bạn xem thẻ công việc mới nhất giúp mình nhé.`,

  managerCommentHeading: "💬 Tin nhắn từ quản lý",
  commentAckHeading: "📝 Đã ghi nhận ghi chú",

  // Choosing between several open tasks
  pickMenu: (total: number) =>
    `📋 Danh sách việc đang mở\n\nBạn đang có ${total} việc. Bấm chọn việc bên dưới:`,
  taskPickInvalid:
    "Mình chưa hiểu. Bạn bấm vào việc muốn chọn bên trên, hoặc trả lời số thứ tự của việc đó.",
  taskPickImageHeld:
    "Đã nhận ảnh. Bạn vui lòng chọn việc cho ảnh này ở danh sách bên trên.",
  /** Card shown when the employee picks a task from the menu. */
  pickedCardHeading: "📌 Công việc đang trao đổi",
  pickedCardClosing:
    "Các tin nhắn/ảnh tiếp theo sẽ được gắn vào việc này.",
  progressHeading: "📝 Báo cáo tiến độ",
  progressClosing:
    "Bạn hãy gửi nội dung hoặc ảnh cập nhật cho việc này. Tin nhắn tiếp theo sẽ được ghi vào công việc.",
  oneTaskHeading: "📋 Bạn đang có 1 việc mở",
  oneTaskClosing: "Cứ nhắn ở đây để cập nhật.",

  // Fallbacks
  noActiveTask:
    "Hiện bạn không có công việc nào đang mở. Khi có việc mới, thẻ công việc sẽ xuất hiện tại đây.",
  help:
    "Bạn có thể: bấm nút trên thẻ công việc, nhắn tin/gửi ảnh để cập nhật việc, " +
    "hoặc bấm 📋 Việc của tôi để xem danh sách việc đang mở.",
  genericAck: "Đã nhận. ✅",

  /** Title of the Zalo `request_user_info` card (sent from the tester). */
  requestInfoTitle: "Đời Sống Xanh muốn kết nối với bạn",
};

/**
 * Copy for the Android app's push notifications and inbox rows. Kept with the
 * bot strings so every employee-facing sentence is tuned in one place.
 */
export const mobilePush = {
  taskNew: (t: TaskLabelInput) => ({
    title: `Việc mới · ${t.ref}`,
    body: t.title,
  }),
  taskUrgent: (t: TaskLabelInput) => ({
    title: `KHẨN · ${t.ref}`,
    body: `Cần xác nhận đã nhận: ${t.title}`,
  }),
  taskUpdated: (t: TaskLabelInput) => ({
    title: `Cập nhật · ${t.ref}`,
    body: t.title,
  }),
  taskReminder: (t: TaskLabelInput) => ({
    title: `Nhắc hạn · ${t.ref}`,
    body: t.title,
  }),
  managerMessage: (text: string) => ({
    title: "Tin nhắn từ quản lý",
    body: text,
  }),
} as const;

/** First task every linked employee gets so they can try the buttons safely. */
export const ONBOARDING_TASK = {
  title: "🌱 Việc làm quen: thử các nút Bắt đầu / Đã xong / Báo sự cố",
  description:
    "Đây là việc thử để bạn làm quen hệ thống, không ảnh hưởng công việc thật. " +
    "Bạn cứ bấm ▶️ Bắt đầu, gửi ảnh/ghi chú, rồi ✔️ Đã xong — hoặc ⚠️ Báo sự cố.",
} as const;
