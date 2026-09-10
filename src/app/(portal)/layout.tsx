import Link from "next/link";
import { requireUser } from "@/lib/session";
import { env } from "@/env";
import { SignOutButton } from "./sign-out-button";

const NAV = [
  { href: "/dashboard", label: "Tổng quan" },
  { href: "/tasks", label: "Công việc" },
  { href: "/employees", label: "Nhân viên" },
  { href: "/settings/zalo", label: "Zalo OA" },
];

export default async function PortalLayout({
  children,
}: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex flex-1">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-card p-4 sm:block">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="text-xl">🌿</span>
          <span className="font-semibold">Đời Sống Xanh</span>
        </div>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-background"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <div className="flex gap-3 text-sm sm:hidden">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:underline">
                {item.label}
              </Link>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {env.ZALO_TRANSPORT === "mock" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Zalo: mô phỏng
              </span>
            )}
            <span className="text-muted">{user.email}</span>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
