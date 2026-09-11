"use client"

import { useActionState } from "react"
import { PlusCircleIcon } from "@phosphor-icons/react"

import { createEmployeeAction } from "@/lib/actions/employees"
import { inputClass } from "@/components/ui"
import { Button } from "@/components/ui/button"
import { SubmitButton } from "@/components/action-form"
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
import { useActionToast } from "@/hooks/use-action-toast"
import { useIsMobile } from "@/hooks/use-mobile"

export function AddEmployeeDrawer() {
  const isMobile = useIsMobile()
  const [state, formAction, pending] = useActionState(
    createEmployeeAction,
    null
  )
  useActionToast(state, pending, {
    id: "employee-create",
    successMessage: "Đã thêm nhân viên",
    redirect: true,
  })

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
          action={formAction}
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
              <FieldDescription>Số liên hệ của nhân viên.</FieldDescription>
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
            {state?.error && (
              <p className="text-destructive text-sm">{state.error}</p>
            )}
          </div>
          <DrawerFooter>
            <SubmitButton>Thêm nhân viên</SubmitButton>
            <DrawerClose render={<Button type="button" variant="outline" />}>
              Huỷ
            </DrawerClose>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
