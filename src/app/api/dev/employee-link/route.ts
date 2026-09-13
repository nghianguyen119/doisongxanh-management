import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { env, isRealSendTesterEnabled } from "@/env";
import { signEmployeeLinkToken } from "@/lib/employee-link";
import { getZaloClient } from "@/lib/zalo/factory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Non-production tester for the read-only employee link (`/my/tasks`).
 *
 *   GET  /api/dev/employee-link?employeeId=<uuid>[&baseUrl=<https://...>]
 *        -> { url }  (generates a token, never sends anything)
 *   POST /api/dev/employee-link
 *        { employeeId, send?, zaloUserId?, baseUrl? }
 *        -> { url } plus { transport, messageId } when a message was sent.
 *
 * Sending requires an explicit `zaloUserId` (the recipient's own Zalo id);
 * it never falls back to the employee's linked Zalo id, so a misconfigured
 * call cannot message a real employee. The `baseUrl` override lets the URL
 * point at a public tunnel while the app itself runs on localhost.
 */

const employeeIdSchema = z.string().uuid();

const postSchema = z.object({
  employeeId: employeeIdSchema,
  zaloUserId: z.string().trim().min(1).optional(),
  send: z.boolean().optional(),
  baseUrl: z.string().url().optional(),
});

function linkUrl(employeeId: string, baseUrl?: string): string {
  const base = (baseUrl ?? env.NEXT_PUBLIC_APP_URL).replace(/\/+$/, "");
  return `${base}/my/tasks?token=${encodeURIComponent(
    signEmployeeLinkToken(employeeId),
  )}`;
}

async function employeeExists(employeeId: string): Promise<boolean> {
  const row = await db.query.employee.findFirst({
    where: eq(employee.id, employeeId),
    columns: { id: true },
  });
  return !!row;
}

function disabled() {
  return NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function GET(req: NextRequest) {
  if (!isRealSendTesterEnabled()) return disabled();

  const params = req.nextUrl.searchParams;
  const parsedId = employeeIdSchema.safeParse(params.get("employeeId"));
  if (!parsedId.success) {
    return NextResponse.json(
      { error: "employeeId must be a uuid" },
      { status: 400 },
    );
  }

  const baseUrl = params.get("baseUrl") ?? undefined;
  const parsedBase = z.string().url().safeParse(baseUrl);
  if (baseUrl && !parsedBase.success) {
    return NextResponse.json(
      { error: "baseUrl must be an absolute url" },
      { status: 400 },
    );
  }

  if (!(await employeeExists(parsedId.data))) {
    return NextResponse.json({ error: "employee not found" }, { status: 404 });
  }

  return NextResponse.json({
    url: linkUrl(parsedId.data, parsedBase.success ? parsedBase.data : undefined),
  });
}

export async function POST(req: NextRequest) {
  if (!isRealSendTesterEnabled()) return disabled();

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid body",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { employeeId, zaloUserId, send, baseUrl } = parsed.data;

  if (!(await employeeExists(employeeId))) {
    return NextResponse.json({ error: "employee not found" }, { status: 404 });
  }

  const url = linkUrl(employeeId, baseUrl);

  if (send !== true) {
    return NextResponse.json({ url, sent: false });
  }
  if (!zaloUserId) {
    return NextResponse.json(
      { url, sent: false, error: "zaloUserId is required when send=true" },
      { status: 400 },
    );
  }

  const client = getZaloClient();
  const { messageId } = await client.sendButtons(
    zaloUserId,
    "Việc của bạn đã sẵn sàng. Bấm nút bên dưới để xem danh sách.",
    [{ title: "Xem việc của tôi", url }],
  );

  return NextResponse.json({
    url,
    sent: true,
    transport: client.transport,
    messageId,
  });
}
