"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Server actions reject invalid operations (e.g. verifying an already
 * cancelled task) by throwing; this turns that into something a manager can
 * read and recover from instead of a blank screen.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="mx-auto max-w-md gap-0 p-5 text-center">
      <div className="text-3xl">⚠️</div>
      <h2 className="mt-2 font-semibold">Không thực hiện được</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {error.message || "Đã có lỗi xảy ra. Vui lòng thử lại."}
      </p>
      <Button className="mt-4" onClick={reset}>
        Thử lại
      </Button>
    </Card>
  );
}
