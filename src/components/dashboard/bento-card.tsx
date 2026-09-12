import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared shell for the dashboard tiles: softer radius and shadow than the
 * stock `Card`, semantic tokens only so dark mode keeps working.
 */
export function BentoCard({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "relative flex flex-col overflow-hidden rounded-3xl bg-card text-card-foreground ring-1 ring-foreground/5",
        "shadow-[0_1px_1px_rgba(15,23,42,0.03),0_14px_36px_-24px_rgba(15,23,42,0.22)]",
        "dark:shadow-none dark:ring-foreground/10",
        className,
      )}
      {...props}
    />
  );
}

export function BentoHeader({
  label,
  aside,
  className,
}: {
  label: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <h2 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </h2>
      {aside}
    </div>
  );
}
