"use client";

import * as React from "react";
import { CalendarBlankIcon } from "@phosphor-icons/react";
import { vi } from "react-day-picker/locale";
import { cn } from "cn";
import { inputClass } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const MINUTE_STEP = 5;
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) =>
  String(i * MINUTE_STEP).padStart(2, "0"),
);
const HOURS = Array.from({ length: 24 }, (_, h) =>
  String(h).padStart(2, "0"),
);

const pad = (n: number) => String(n).padStart(2, "0");

/** Splits a `datetime-local` value (Vietnam wall time) into its parts. */
function splitValue(value?: string) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value?.trim() ?? "");
  return m
    ? { ymd: m[1], hour: m[2], minute: m[3] }
    : { ymd: "", hour: "17", minute: "00" };
}

/** A `Date` carrying just the wall-clock day, for the Calendar. */
function toCalendarDay(ymd: string): Date | undefined {
  if (!ymd) return undefined;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function label(ymd: string, hour: string, minute: string) {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y} ${hour}:${minute}`;
}

/**
 * Due-date picker: Popover + the shared Calendar for the day, hour/minute
 * selects for the time. The hidden input carries a `datetime-local` string in
 * Vietnam wall time — exactly what `parseVNInput` expects, so no browser or
 * server timezone math is involved.
 */
export function DateTimePicker({
  id,
  name,
  defaultValue,
  placeholder = "Chọn hạn",
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const initial = React.useMemo(() => splitValue(defaultValue), [defaultValue]);
  const [ymd, setYmd] = React.useState(initial.ymd);
  const [hour, setHour] = React.useState(initial.hour);
  const [minute, setMinute] = React.useState(initial.minute);
  const [open, setOpen] = React.useState(false);

  const displayed = toCalendarDay(ymd);
  const minutes = React.useMemo(
    () => (MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort()),
    [minute],
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start font-normal",
                !ymd && "text-muted-foreground",
              )}
            />
          }
        >
          <CalendarBlankIcon />
          {ymd ? label(ymd, hour, minute) : placeholder}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-3">
          <Calendar
            mode="single"
            locale={vi}
            selected={displayed}
            defaultMonth={displayed}
            onSelect={(date) => {
              if (!date) return;
              setYmd(
                `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
              );
            }}
            autoFocus
          />
          <div className="flex items-center gap-2 border-t pt-3">
            <span className="text-muted-foreground">Giờ</span>
            <select
              aria-label="Giờ"
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className={cn(inputClass, "w-auto")}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span>:</span>
            <select
              aria-label="Phút"
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className={cn(inputClass, "w-auto")}
            >
              {minutes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-1">
              {ymd && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setYmd("")}
                >
                  Xóa
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                Xong
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <input
        type="hidden"
        name={name}
        value={ymd ? `${ymd}T${hour}:${minute}` : ""}
      />
    </>
  );
}
