import Link from "next/link";
import { BentoCard, BentoHeader } from "./bento-card";

export type WorkloadEntry = {
  employeeId: string;
  name: string;
  open: number;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export function WorkloadTile({
  workload,
  className,
}: {
  workload: WorkloadEntry[];
  className?: string;
}) {
  const busy = workload.filter((entry) => entry.open > 0);
  const visible = busy.slice(0, 8);
  const hidden = busy.length - visible.length;
  const max = busy.reduce((peak, entry) => Math.max(peak, entry.open), 0);

  return (
    <BentoCard className={className}>
      <div className="relative flex flex-1 flex-col p-6 @3xl/main:p-7">
        <BentoHeader label="Khối lượng theo nhân viên" />

        {visible.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-10">
            <p className="text-sm text-muted-foreground">
              Chưa có nhân viên nào đang có việc.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-1 flex-col gap-1">
            {visible.map((entry) => {
              const width =
                max > 0
                  ? Math.max(6, Math.round((entry.open / max) * 100))
                  : 0;
              return (
                <li key={entry.employeeId}>
                  <Link
                    href={`/employees/${entry.employeeId}`}
                    className="group -mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-muted/60"
                  >
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/15 to-primary/5 text-xs font-semibold text-primary"
                    >
                      {initials(entry.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium group-hover:underline">
                          {entry.name}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {entry.open}
                        </span>
                      </span>
                      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-linear-to-r from-primary/60 to-primary"
                          style={{ width: `${width}%` }}
                        />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {hidden > 0 && (
          <Link
            href="/employees"
            className="mt-4 inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Xem thêm {hidden} nhân viên khác
          </Link>
        )}
      </div>
    </BentoCard>
  );
}
