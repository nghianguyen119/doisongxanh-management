"use client"

import {
  ListChecksIcon,
  WarningIcon,
  HourglassMediumIcon,
  SealCheckIcon,
} from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type SectionCardsStats = {
  /** assigned + in_progress + blocked */
  open: number
  overdue: number
  /** done, waiting for manager verification */
  awaitingVerification: number
  verified: number
}

export function SectionCards({ stats }: { stats: SectionCardsStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Đang mở</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.open}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <ListChecksIcon />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Công việc chưa hoàn tất
          </div>
          <div className="text-muted-foreground">
            Đã giao, đang chờ hoặc đang làm
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Quá hạn</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.overdue}
          </CardTitle>
          <CardAction>
            {stats.overdue > 0 ? (
              <Badge variant="destructive">
                <WarningIcon />
                Cần xử lý
              </Badge>
            ) : (
              <Badge variant="outline">
                <SealCheckIcon />
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {stats.overdue > 0 ? "Cần nhắc nhân viên" : "Mọi việc đúng hạn 🎉"}
          </div>
          <div className="text-muted-foreground">
            Công việc mở đã quá hạn chót
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Chờ xác nhận</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.awaitingVerification}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <HourglassMediumIcon />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Nhân viên đã báo xong
          </div>
          <div className="text-muted-foreground">
            Chờ quản lý kiểm tra, xác nhận
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Đã xác nhận</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.verified}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <SealCheckIcon />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Công việc hoàn tất
          </div>
          <div className="text-muted-foreground">
            Đã qua kiểm tra của quản lý
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
