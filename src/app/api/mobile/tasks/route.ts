import { NextResponse, type NextRequest } from "next/server";
import { requireMobile } from "@/lib/mobile/api";
import { listEmployeeTasks } from "@/lib/mobile/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireMobile(req);
  if ("response" in auth) return auth.response;

  const tasks = await listEmployeeTasks(auth.session.employee.id);
  return NextResponse.json({ tasks });
}
