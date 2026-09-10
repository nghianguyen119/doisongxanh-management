import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Đời Sống Xanh — Quản lý công việc",
  description: "Cổng quản lý công việc, giao việc qua Zalo OA.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
