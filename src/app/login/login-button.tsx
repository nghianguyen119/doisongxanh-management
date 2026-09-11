"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function LoginButton({ next }: { next: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      className="w-full"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await signIn.social({ provider: "google", callbackURL: next });
      }}
    >
      {loading ? "Đang chuyển..." : "Đăng nhập với Google"}
    </Button>
  );
}
