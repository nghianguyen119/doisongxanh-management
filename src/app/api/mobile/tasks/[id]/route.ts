import { NextResponse, type NextRequest } from "next/server";
import { jsonError, requireMobile } from "@/lib/mobile/api";
import { getEmployeeTaskDetail } from "@/lib/mobile/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/mobile/tasks/[id]">,
) {
  const auth = await requireMobile(req);
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  const detail = await getEmployeeTaskDetail(auth.session.employee.id, id);
  if (!detail) {
    return jsonError(404, "Không tìm thấy công việc.");
  }
  return NextResponse.json(detail);
}
