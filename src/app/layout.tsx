import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Đời Sống Xanh — Quản lý công việc",
  description: "Cổng quản lý công việc, giao việc qua Zalo OA.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body className="relative min-h-full flex flex-col">
        <NuqsAdapter>{children}</NuqsAdapter>
        <Toaster />
      </body>
    </html>
  );
}
