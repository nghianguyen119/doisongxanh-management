import type {
  employeeStatus,
  taskEventType,
  taskPriority,
  taskStatus,
} from "@/db/schema";

type TaskStatus = (typeof taskStatus.enumValues)[number];
type TaskPriority = (typeof taskPriority.enumValues)[number];
type EmployeeStatus = (typeof employeeStatus.enumValues)[number];
type TaskEventType = (typeof taskEventType.enumValues)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  new: "Mới tạo",
  assigned: "Đã giao",
  accepted: "Đã nhận",
  in_progress: "Đang làm",
  blocked: "Gặp sự cố",
  done: "Đã xong",
  verified: "Đã xác nhận",
  cancelled: "Đã huỷ",
};

export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  new: "bg-gray-100 text-gray-700",
  assigned: "bg-blue-100 text-blue-700",
  accepted: "bg-indigo-100 text-indigo-700",
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

export const TASK_EVENT_LABEL: Record<TaskEventType, string> = {
  created: "Tạo công việc",
  assigned: "Giao việc",
  status_changed: "Đổi trạng thái",
  comment: "Trao đổi",
  issue_reported: "Báo sự cố",
  attachment_added: "Đính kèm ảnh",
  reminder_sent: "Đã gửi Zalo",
};

export const OPEN_TASK_STATUSES: TaskStatus[] = [
  "assigned",
  "accepted",
  "in_progress",
  "blocked",
];
