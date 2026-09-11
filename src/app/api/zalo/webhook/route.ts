import { after, NextResponse, type NextRequest } from "next/server";
import { dispatchInbound } from "@/lib/zalo/dispatch";
import { parseZaloWebhook } from "@/lib/zalo/parse";
import { verifyZaloSignature } from "@/lib/zalo/signature";
import type { RawZaloWebhook } from "@/lib/zalo/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Background processing runs after the 200; give it room on Vercel. */
export const maxDuration = 60;

// Zalo pings this during webhook setup; also handy for a quick liveness check.
export function GET() {
  return new NextResponse("Zalo OA webhook OK", { status: 200 });
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const rawBody = await req.text();

  let body: RawZaloWebhook;
  try {
    body = JSON.parse(rawBody) as RawZaloWebhook;
  } catch {
    console.error(`[zalo:webhook] bad json bytes=${rawBody.length}`);
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const signature = req.headers.get("x-zevent-signature");
  if (!verifyZaloSignature(rawBody, signature, body.timestamp)) {
    console.error(
      `[zalo:webhook] rejected bad signature event=${body.event_name} ` +
        `hasSignature=${Boolean(signature)} hasTimestamp=${Boolean(body.timestamp)} ` +
        `bytes=${rawBody.length}`,
    );
    return NextResponse.json(
      { ok: false, error: "bad signature" },
      { status: 401 },
    );
  }

  const event = parseZaloWebhook(body);
  const sender =
    body.sender?.id ?? body.follower?.id ?? body.user_id ?? "unknown";
  console.log(
    `[zalo:webhook] received sig=ok event=${body.event_name} ` +
      `parsed=${event?.kind ?? "none"} sender=${sender} ` +
      `msg_id=${body.message?.msg_id ?? "-"} in ${Date.now() - started}ms`,
  );

  if (event) {
    // Answer Zalo immediately — they require 200 OK within a short timeout,
    // and the conversation work below can involve DB writes and outbound Zalo
    // API calls. `after` keeps that running on Vercel after the response.
    after(async () => {
      try {
        await dispatchInbound(event);
      } catch (err) {
        console.error("[zalo:webhook] background dispatch failed", err);
      }
    });
  }

  return NextResponse.json({ ok: true });
}
