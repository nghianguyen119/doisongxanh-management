"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Starts the Zalo Login flow. `/zalo-login/start` is a plain GET that sets the
 * PKCE cookies and redirects straight to Zalo, so a normal navigation is
 * enough — no client-side OAuth logic here.
 */
export function LoginButton({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      className="w-full"
      disabled={!configured || loading}
      onClick={() => {
        setLoading(true);
        router.push("/zalo-login/start");
      }}
    >
      {loading ? "Đang chuyển..." : "Đăng nhập với Zalo"}
    </Button>
  );
}
