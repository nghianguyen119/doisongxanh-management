import type {
  employeeStatus,
  taskEventType,
  taskPriority,
  taskStatus,
} from "@/db/schema";
import type { NotificationKind } from "@/lib/workflow/notification-service";

type TaskStatus = (typeof taskStatus.enumValues)[number];
type TaskPriority = (typeof taskPriority.enumValues)[number];
type EmployeeStatus = (typeof employeeStatus.enumValues)[number];
type TaskEventType = (typeof taskEventType.enumValues)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  assigned: "Cần làm",
  in_progress: "Đang làm",
  blocked: "Gặp sự cố",
  done: "Đã xong",
  verified: "Đã xác nhận",
  cancelled: "Đã huỷ",
};

export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  assigned: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-800",
  blocked: "bg-red-100 text-red-700",
  done: "bg-emerald-100 text-emerald-700",
  verified: "bg-green-200 text-green-900",
  cancelled: "bg-gray-200 text-gray-500",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
  urgent: "Khẩn",
};

export const EMPLOYEE_STATUS_LABEL: Record<EmployeeStatus, string> = {
  invited: "Chờ kết nối",
  active: "Đang hoạt động",
  inactive: "Ngừng",
};

export const EMPLOYEE_STATUS_TONE: Record<EmployeeStatus, string> = {
  invited: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-gray-200 text-gray-500",
};

export const TASK_EVENT_LABEL: Record<TaskEventType, string> = {
  created: "Tạo công việc",
  updated: "Sửa nội dung",
  assigned: "Giao việc",
  status_changed: "Đổi trạng thái",
  comment: "Trao đổi",
  issue_reported: "Báo sự cố",
  attachment_added: "Đính kèm ảnh",
  reminder_sent: "Đã gửi Zalo",
  notification: "Thông báo Zalo",
};

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  assigned: "Thẻ giao việc",
  updated: "Cập nhật công việc",
  started: "Xác nhận bắt đầu",
  done: "Báo hoàn thành",
  issue: "Xác nhận sự cố",
  verified: "Duyệt hoàn thành",
  cancelled: "Thông báo huỷ",
  comment: "Lời nhắn cho nhân viên",
  reminder: "Nhắc hạn",
};

/**
 * Statuses where a task is still live and appears in the employee's list.
 * `assigned` includes unassigned drafts; they have no assignee so they never
 * reach an employee, but they count as open for the portal/dashboard.
 */
export const OPEN_TASK_STATUSES: TaskStatus[] = [
  "assigned",
  "in_progress",
  "blocked",
];
