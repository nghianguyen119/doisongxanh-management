"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary for errors thrown in the root layout or outside the
 * portal. It replaces the root layout, so styles must be inline (Tailwind is
 * not guaranteed to be loaded here).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#fafafa",
          color: "#18181b",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <h1 style={{ margin: "8px 0", fontSize: 20 }}>
            Đã có lỗi xảy ra
          </h1>
          <p style={{ margin: 0, color: "#52525b", fontSize: 14 }}>
            Hệ thống đã ghi nhận lỗi này. Vui lòng thử lại.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #d4d4d8",
              background: "#18181b",
              color: "#fafafa",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}
