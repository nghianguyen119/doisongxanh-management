import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, requireMobile } from "@/lib/mobile/api";
import { taskSummaryById } from "@/lib/mobile/tasks";
import { nudgeManager, type NudgeFailure } from "@/lib/workflow/task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const nudgeSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string().trim().max(2000).optional(),
});

const FAILURE_MESSAGE: Record<
  Exclude<NudgeFailure, "not_found" | "text_required">,
  string
> = {
  not_waiting: "Công việc chưa ở trạng thái chờ quản lý xử lý.",
  too_soon: "Vừa báo xong. Vui lòng chờ khoảng 30 phút rồi hối.",
  outside_hours: "Ngoài giờ làm việc. Vui lòng hối lại sau 07:00.",
  daily_cap: "Hôm nay đã hối đủ 3 lần. Vui lòng hối lại sau 07:00.",
  cooldown: "Vừa hối xong. Vui lòng chờ thêm rồi thử lại.",
  escalated: "Đã vượt cấp và đang chờ phản hồi. Vui lòng chờ quản lý.",
};

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/mobile/tasks/[id]/nudge">,
) {
  const auth = await requireMobile(req);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Dữ liệu không hợp lệ.");
  }
  const parsed = nudgeSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Dữ liệu không hợp lệ.");

  const { id } = await ctx.params;
  const res = await nudgeManager({
    taskId: id,
    employeeId: auth.session.employee.id,
    ...parsed.data,
  });

  if (!res.ok) {
    if (res.reason === "not_found") {
      return jsonError(404, "Không tìm thấy công việc.");
    }
    if (res.reason === "text_required") {
      return jsonError(400, "Vui lòng nhập lý do khi vượt cấp.");
    }
    return jsonError(409, FAILURE_MESSAGE[res.reason]);
  }

  const summary = await taskSummaryById(id);
  if (!summary) return jsonError(404, "Không tìm thấy công việc.");
  return NextResponse.json({
    task: summary,
    nudgeCount: res.nudgeCount,
    nextNudgeAt: res.nextNudgeAt ? res.nextNudgeAt.toISOString() : null,
  });
}
