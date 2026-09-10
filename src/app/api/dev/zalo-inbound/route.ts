import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { zaloMessageLog } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { env } from "@/env";
import { dispatchInbound } from "@/lib/zalo/dispatch";
import type { InboundEvent } from "@/lib/zalo/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mock-only endpoint powering the /settings/zalo simulator. Accepts a
 * simplified body and turns it into an InboundEvent:
 *   { zaloUserId, kind: "text",  text }
 *   { zaloUserId, kind: "image", imageUrls: [] }
 *   { zaloUserId, kind: "follow" | "unfollow" }
 *   { zaloUserId, kind: "user_info", name?, phone? }
 * Returns the updated message thread for that Zalo user.
 */
async function threadFor(zaloUserId: string) {
  const rows = await db.query.zaloMessageLog.findMany({
    where: eq(zaloMessageLog.zaloUserId, zaloUserId),
    orderBy: desc(zaloMessageLog.createdAt),
    limit: 60,
  });
  return rows.reverse();
}

export async function GET(req: NextRequest) {
  if (env.ZALO_TRANSPORT !== "mock") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const zaloUserId = req.nextUrl.searchParams.get("zaloUserId");
  if (!zaloUserId) {
    return NextResponse.json({ error: "zaloUserId required" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, thread: await threadFor(zaloUserId) });
}

export async function POST(req: NextRequest) {
  if (env.ZALO_TRANSPORT !== "mock") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json()) as Partial<InboundEvent> & {
    zaloUserId?: string;
  };
  if (!body.zaloUserId || !body.kind) {
    return NextResponse.json(
      { error: "zaloUserId and kind are required" },
      { status: 400 },
    );
  }

  const event = { raw: undefined, ...body } as InboundEvent;
  await dispatchInbound(event);

  return NextResponse.json({ ok: true, thread: await threadFor(body.zaloUserId) });
}
