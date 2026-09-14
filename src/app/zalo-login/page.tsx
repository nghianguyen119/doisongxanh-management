import type { Metadata } from "next";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { isZaloLoginConfigured } from "@/env";
import { SESSION_COOKIE, verifyLoginSession } from "@/lib/zalo-login";
import { cn } from "@/lib/utils";
import { LoginButton } from "./login-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đăng nhập Zalo — Đời Sống Xanh",
  description: "Trang thử đăng nhập bằng Zalo dành cho nhân viên.",
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Chưa cấu hình Zalo Login (thiếu ZALO_LOGIN_APP_ID/SECRET).",
  cancelled: "Bạn đã hủy đăng nhập.",
  invalid: "Phiên đăng nhập không hợp lệ. Vui lòng thử lại.",
  state_mismatch: "Trạng thái đăng nhập không khớp. Vui lòng thử lại.",
  token_exchange_failed: "Không thể xác thực với Zalo. Vui lòng thử lại.",
  profile_failed: "Không thể đọc thông tin Zalo. Vui lòng thử lại.",
};

export default async function ZaloLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const configured = isZaloLoginConfigured();
  const session = verifyLoginSession(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  const { error } = await searchParams;
  const errorMessage =
    typeof error === "string" ? (ERROR_MESSAGES[error] ?? null) : null;

  const matched = session
    ? ((await db.query.employee.findFirst({
        where: eq(employee.zaloUserId, session.zaloUserId),
      })) ?? null)
    : null;

  return (
    <main className="min-h-dvh bg-muted/40">
      <div className="mx-auto w-full max-w-xl space-y-5 px-4 py-6 sm:px-6 lg:py-10">
        <header className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <p className="text-[11px] font-semibold tracking-widest text-primary uppercase">
            Đời Sống Xanh
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Đăng nhập với Zalo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trang thử nghiệm — nhân viên đăng nhập bằng tài khoản Zalo cá nhân.
          </p>
        </header>

        {errorMessage && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        {session ? (
          <LoggedIn
            zaloUserId={session.zaloUserId}
            zaloName={session.name}
            zaloAvatar={session.avatar}
            employee={matched}
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="mb-4 text-sm text-muted-foreground">
              Bấm nút bên dưới để chuyển sang Zalo và cấp quyền đăng nhập.
            </p>
            <LoginButton configured={configured} />
            {!configured && (
              <p className="mt-3 text-xs text-muted-foreground">
                Cần điền <code>ZALO_LOGIN_APP_ID</code> và{" "}
                <code>ZALO_LOGIN_APP_SECRET</code> trong <code>.env</code> để bật
                nút đăng nhập.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function LoggedIn({
  zaloUserId,
  zaloName,
  zaloAvatar,
  employee,
}: {
  zaloUserId: string;
  zaloName?: string;
  zaloAvatar?: string;
  employee: {
    name: string;
    position: string | null;
    status: "invited" | "active" | "inactive";
  } | null;
}) {
  const displayName = zaloName || "Người dùng Zalo";
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <Avatar src={zaloAvatar} name={displayName} />
        <div className="min-w-0">
          <p className="font-semibold">{displayName}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {zaloUserId}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background p-4 text-sm">
        {employee ? (
          <p>
            <span className="text-muted-foreground">Nhân viên khớp: </span>
            <span className="font-medium">{employee.name}</span>
            {employee.position && (
              <span className="text-muted-foreground">
                {" "}
                · {employee.position}
              </span>
            )}
            <span
              className={cn(
                "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
                employee.status === "inactive"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary",
              )}
            >
              {employee.status}
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">
            Tài khoản Zalo này chưa được liên kết với nhân viên nào.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Bạn đã đăng nhập thành công.
        </p>
        <a
          href="/zalo-login/logout"
          className="text-xs font-medium underline underline-offset-4"
        >
          Đăng xuất
        </a>
      </div>
    </div>
  );
}

function Avatar({ src, name }: { src?: string; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  if (!src) {
    return (
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
        {initial}
      </span>
    );
  }
  return (
    // Plain <img>: the Zalo avatar host is not in next/image's allowlist and
    // this page is a throwaway test, so no need to add a remotePattern.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="size-12 shrink-0 rounded-full object-cover"
      referrerPolicy="no-referrer"
    />
  );
}
