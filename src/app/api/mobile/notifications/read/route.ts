import { type NextRequest } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { mobileNotification } from "@/db/schema";
import { jsonError, noContent, requireMobile } from "@/lib/mobile/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readSchema = z.object({
  ids: z.array(z.string().uuid()).max(100).optional(),
});

/** Mark specific notifications read; omit `ids` (or send `[]`) for all. */
export async function POST(req: NextRequest) {
  const auth = await requireMobile(req);
  if ("response" in auth) return auth.response;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // An empty body means "mark everything".
  }
  const parsed = readSchema.safeParse(body ?? {});
  if (!parsed.success) return jsonError(400, "Dữ liệu không hợp lệ.");

  const ids = parsed.data.ids;
  await db
    .update(mobileNotification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(mobileNotification.employeeId, auth.session.employee.id),
        isNull(mobileNotification.readAt),
        ids && ids.length > 0
          ? inArray(mobileNotification.id, ids)
          : undefined,
      ),
    );

  return noContent();
}
