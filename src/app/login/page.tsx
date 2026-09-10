import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginButton } from "./login-button";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  if (await getSession()) redirect("/dashboard");
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : "/dashboard";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="text-3xl">🌿</div>
        <h1 className="mt-3 text-lg font-semibold">Đời Sống Xanh</h1>
        <p className="mt-1 text-sm text-muted">
          Cổng quản lý công việc dành cho quản lý.
        </p>
        <div className="mt-6">
          <LoginButton next={target} />
        </div>
        <p className="mt-4 text-xs text-muted">
          Chỉ các tài khoản Google được cấp quyền mới đăng nhập được.
        </p>
      </div>
    </main>
  );
}
