"use client"

import { PlusCircleIcon } from "@phosphor-icons/react"

import { createEmployeeAction } from "@/lib/actions/employees"
import { inputClass } from "@/components/ui"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { useIsMobile } from "@/hooks/use-mobile"

export function AddEmployeeDrawer() {
  const isMobile = useIsMobile()

  return (
    <Drawer swipeDirection={isMobile ? "down" : "right"}>
      <DrawerTrigger render={<Button />}>
        <PlusCircleIcon />
        Thêm nhân viên
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Thêm nhân viên</DrawerTitle>
          <DrawerDescription>
            Tạo hồ sơ để giao việc và gửi thông báo qua Zalo.
          </DrawerDescription>
        </DrawerHeader>
        <form
          action={createEmployeeAction}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <Field>
              <FieldLabel htmlFor="add-employee-name">Tên</FieldLabel>
              <input
                id="add-employee-name"
                name="name"
                required
                className={inputClass}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="add-employee-phone">
                Số điện thoại
              </FieldLabel>
              <input
                id="add-employee-phone"
                name="phone"
                className={inputClass}
              />
              <FieldDescription>
                Dùng để nhân viên tự kết nối bằng cách chia sẻ SĐT trên Zalo.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="add-employee-position">Vị trí</FieldLabel>
              <input
                id="add-employee-position"
                name="position"
                className={inputClass}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="add-employee-note">Ghi chú</FieldLabel>
              <textarea
                id="add-employee-note"
                name="note"
                rows={2}
                placeholder="Ví dụ: phụ trách sảnh chính và tầng 1"
                className={inputClass}
              />
            </Field>
          </div>
          <DrawerFooter>
            <Button type="submit">Thêm nhân viên</Button>
            <DrawerClose render={<Button type="button" variant="outline" />}>
              Huỷ
            </DrawerClose>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
