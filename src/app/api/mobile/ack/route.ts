import { type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, noContent, requireMobile } from "@/lib/mobile/api";
import { acknowledgeTask } from "@/lib/workflow/task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ackSchema = z.object({
  taskId: z.string().uuid(),
  deliveryId: z.string().trim().max(200).optional(),
});

/** The app's «Đã nhận»: records the ack and stops the alert chain. */
export async function POST(req: NextRequest) {
  const auth = await requireMobile(req);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Dữ liệu không hợp lệ.");
  }
  const parsed = ackSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Dữ liệu không hợp lệ.");

  const res = await acknowledgeTask({
    taskId: parsed.data.taskId,
    employeeId: auth.session.employee.id,
    deliveryId: parsed.data.deliveryId,
  });
  if (!res.ok) return jsonError(404, "Không tìm thấy công việc.");
  return noContent();
}
