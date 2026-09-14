import { NextResponse, type NextRequest } from "next/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { mobileNotification } from "@/db/schema";
import { requireMobile } from "@/lib/mobile/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 50;

/** Inbox for the header bell, newest first. */
export async function GET(req: NextRequest) {
  const auth = await requireMobile(req);
  if ("response" in auth) return auth.response;
  const employeeId = auth.session.employee.id;

  const [rows, unread] = await Promise.all([
    db.query.mobileNotification.findMany({
      where: eq(mobileNotification.employeeId, employeeId),
      orderBy: desc(mobileNotification.createdAt),
      limit: MAX_ITEMS,
    }),
    db
      .select({ n: count() })
      .from(mobileNotification)
      .where(
        and(
          eq(mobileNotification.employeeId, employeeId),
          isNull(mobileNotification.readAt),
        ),
      ),
  ]);

  return NextResponse.json({
    unreadCount: Number(unread[0]?.n ?? 0),
    items: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      taskId: row.taskId,
      createdAt: row.createdAt.toISOString(),
      read: row.readAt !== null,
    })),
  });
}
