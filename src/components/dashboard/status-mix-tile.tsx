"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { TASK_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/workflow/task-status";
import { BentoCard, BentoHeader } from "./bento-card";
import { STATUS_CHART_COLOR, STATUS_DOT_CLASS } from "./status-colors";

const STATUS_ORDER: TaskStatus[] = [
  "assigned",
  "in_progress",
  "blocked",
  "done",
  "verified",
  "cancelled",
];

const chartConfig: ChartConfig = Object.fromEntries(
  STATUS_ORDER.map((status) => [status, { label: TASK_STATUS_LABEL[status] }]),
);

export function StatusMixTile({
  counts,
  total,
  className,
}: {
  counts: Record<TaskStatus, number>;
  total: number;
  className?: string;
}) {
  const data = STATUS_ORDER.filter((status) => counts[status] > 0).map(
    (status) => ({
      status,
      value: counts[status],
    }),
  );

  return (
    <BentoCard className={className}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-20 size-56 rounded-full bg-chart-1/10 blur-3xl"
      />

      <div className="relative flex flex-1 flex-col p-6 @3xl/main:p-7">
        <BentoHeader label="Tình hình công việc" />

        <div className="relative mx-auto mt-5 h-[196px] w-full max-w-[220px]">
          {data.length === 0 ? (
            <div className="flex size-full items-center justify-center rounded-full border-8 border-muted" />
          ) : (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto size-full"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent nameKey="status" hideLabel />}
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="status"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={3}
                  cornerRadius={8}
                  strokeWidth={0}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_CHART_COLOR[entry.status]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          )}

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">
              {total}
            </span>
            <span className="mt-0.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              công việc
            </span>
          </div>
        </div>

        <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 @3xl/main:mt-6">
          {STATUS_ORDER.map((status) => {
            const value = counts[status];
            return (
              <li
                key={status}
                className={cn(
                  "flex items-center gap-2 text-[13px]",
                  value === 0 && "opacity-40",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    STATUS_DOT_CLASS[status],
                  )}
                />
                <span className="truncate text-muted-foreground">
                  {TASK_STATUS_LABEL[status]}
                </span>
                <span className="ml-auto font-semibold tabular-nums">
                  {value}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </BentoCard>
  );
}
