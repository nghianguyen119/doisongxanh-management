"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-background"
      onClick={async () => {
        await signOut();
        router.push("/login");
      }}
    >
      Đăng xuất
    </button>
  );
}
