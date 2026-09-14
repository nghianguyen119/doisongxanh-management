import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { task } from "@/db/schema";
import { jsonError, requireMobile } from "@/lib/mobile/api";
import { taskSummaryById } from "@/lib/mobile/tasks";
import {
  UploadError,
  isUploadFile,
  saveTaskUploads,
  type UploadFile,
} from "@/lib/mobile/uploads";
import * as taskService from "@/lib/workflow/task-service";
import type { TaskResult } from "@/lib/workflow/task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["start", "done", "issue", "comment"]),
  text: z.string().trim().max(2000).optional(),
});

/** Reasons from the workflow mapped to the HTTP status the app expects. */
function taskFailure(res: Extract<TaskResult, { ok: false }>) {
  switch (res.reason) {
    case "not_found":
      return jsonError(404, "Không tìm thấy công việc.");
    case "closed":
      return jsonError(
        409,
        "Công việc đã kết thúc. Liên hệ quản lý nếu cần mở lại.",
      );
    default:
      return jsonError(409, "Không thể thực hiện ở trạng thái hiện tại.");
  }
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/mobile/tasks/[id]/actions">,
) {
  const auth = await requireMobile(req);
  if ("response" in auth) return auth.response;
  const { employee } = auth.session;

  const { id } = await ctx.params;
  const owned = await db.query.task.findFirst({
    where: and(eq(task.id, id), eq(task.assigneeId, employee.id)),
    columns: { id: true },
  });
  if (!owned) return jsonError(404, "Không tìm thấy công việc.");

  const contentType = req.headers.get("content-type") ?? "";
  let rawAction: unknown;
  let rawText: unknown;
  let files: UploadFile[] = [];

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError(400, "Dữ liệu gửi lên không hợp lệ.");
    }
    rawAction = form.get("action");
    rawText = form.get("text");
    files = form
      .getAll("files")
      .filter((value) => isUploadFile(value)) as UploadFile[];
  } else {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Dữ liệu gửi lên không hợp lệ.");
    }
    const record = (body ?? {}) as Record<string, unknown>;
    rawAction = record.action;
    rawText = record.text;
  }

  const parsed = actionSchema.safeParse({
    action: rawAction,
    text: typeof rawText === "string" ? rawText : undefined,
  });
  if (!parsed.success) {
    return jsonError(400, "Hành động không hợp lệ.");
  }
  const { action, text } = parsed.data;
  if ((action === "issue" || action === "comment") && !text) {
    return jsonError(
      400,
      action === "issue"
        ? "Vui lòng nhập nội dung sự cố."
        : "Vui lòng nhập nội dung tin nhắn.",
    );
  }

  let attachmentUrls: string[] = [];
  try {
    attachmentUrls = await saveTaskUploads(id, files);
  } catch (err) {
    if (err instanceof UploadError) return jsonError(err.status, err.message);
    console.error("[mobile] upload failed", err);
    return jsonError(500, "Không lưu được ảnh. Vui lòng thử lại.");
  }

  const input = { taskId: id, employeeId: employee.id, attachmentUrls };
  let res: TaskResult;
  switch (action) {
    case "start":
      res = await taskService.startTask(input);
      break;
    case "done":
      res = await taskService.completeTask(input);
      break;
    case "issue":
      res = await taskService.reportIssue({ ...input, text: text as string });
      break;
    default:
      res = await taskService.addEmployeeComment({
        ...input,
        text: text as string,
      });
  }
  if (!res.ok) return taskFailure(res);

  const summary = await taskSummaryById(id);
  if (!summary) return jsonError(404, "Không tìm thấy công việc.");
  return NextResponse.json({ task: summary });
}
