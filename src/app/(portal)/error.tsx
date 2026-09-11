"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Server actions reject invalid operations (e.g. verifying an already
 * cancelled task) by throwing; this turns that into something a manager can
 * read and recover from instead of a blank screen.
 *
 * In production React/Next redact thrown server-error messages, so the raw
 * text would be "Minified React error #441…". Fall back to a readable line
 * for those, and keep genuine client-side messages.
 */
const MASKED_MESSAGE = /Minified React error|Server Components render/i;

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const raw = error.message || "";
  const message =
    !raw || MASKED_MESSAGE.test(raw)
      ? "Đã có lỗi xảy ra. Vui lòng thử lại."
      : raw;

  return (
    <Card className="mx-auto max-w-md gap-0 p-5 text-center">
      <div className="text-3xl">⚠️</div>
      <h2 className="mt-2 font-semibold">Không thực hiện được</h2>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <Button className="mt-4" onClick={reset}>
        Thử lại
      </Button>
    </Card>
  );
}
