import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginButton } from "./login-button";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  if (await getSession()) redirect("/dashboard");
  const { next } = await searchParams;
  const target = safeNext(next);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="text-3xl">🌿</div>
        <h1 className="mt-3 text-lg font-semibold">Đời Sống Xanh</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cổng quản lý công việc dành cho quản lý.
        </p>
        <div className="mt-6">
          <LoginButton next={target} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Chỉ các tài khoản Google được cấp quyền mới đăng nhập được.
        </p>
      </div>
    </main>
  );
}

/**
 * `?next=` is attacker-controllable and ends up as the post-login redirect,
 * so only same-site absolute paths are allowed. `//evil.com` is protocol
 * relative and would leave the site, hence the second check.
 */
function safeNext(next: string | string[] | undefined): string {
  const fallback = "/dashboard";
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next === "/" ? fallback : next;
}
