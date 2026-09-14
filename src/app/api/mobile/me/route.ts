import { NextResponse, type NextRequest } from "next/server";
import { requireMobile } from "@/lib/mobile/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireMobile(req);
  if ("response" in auth) return auth.response;

  const { employee } = auth.session;
  return NextResponse.json({
    id: employee.id,
    name: employee.name,
    position: employee.position,
  });
}
