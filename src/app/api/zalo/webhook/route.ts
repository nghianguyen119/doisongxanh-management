import { NextResponse, type NextRequest } from "next/server";
import { dispatchInbound } from "@/lib/zalo/dispatch";
import { parseZaloWebhook } from "@/lib/zalo/parse";
import { verifyZaloSignature } from "@/lib/zalo/signature";
import type { RawZaloWebhook } from "@/lib/zalo/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Zalo pings this during webhook setup; also handy for a quick liveness check.
export function GET() {
  return new NextResponse("Zalo OA webhook OK", { status: 200 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let body: RawZaloWebhook;
  try {
    body = JSON.parse(rawBody) as RawZaloWebhook;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const signature = req.headers.get("x-zevent-signature");
  if (!verifyZaloSignature(rawBody, signature, body.timestamp)) {
    return NextResponse.json(
      { ok: false, error: "bad signature" },
      { status: 401 },
    );
  }

  const event = parseZaloWebhook(body);
  if (event) {
    // Awaited so serverless doesn't kill the work, but dispatch never throws.
    await dispatchInbound(event);
  }

  return NextResponse.json({ ok: true });
}
