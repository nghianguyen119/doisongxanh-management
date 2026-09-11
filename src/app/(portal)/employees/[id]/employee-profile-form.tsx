"use client"

import { useActionState } from "react"

import { inputClass } from "@/components/ui"
import { SubmitButton } from "@/components/action-form"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { useActionToast } from "@/hooks/use-action-toast"
import {
  updateEmployeeAction,
  type EmployeeFormState,
} from "@/lib/actions/employees"

export function EmployeeProfileForm({
  employee,
}: {
  employee: {
    id: string
    name: string
    phone: string | null
    position: string | null
    note: string | null
  }
}) {
  const [state, formAction, pending] = useActionState<
    EmployeeFormState,
    FormData
  >(updateEmployeeAction, null)
  useActionToast(state, pending, {
    id: "employee-update",
    successMessage: "Đã lưu thay đổi",
  })

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="employeeId" value={employee.id} />
      <Field>
        <FieldLabel htmlFor="name">Tên</FieldLabel>
        <input
          id="name"
          name="name"
          required
          defaultValue={employee.name}
          className={inputClass}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="phone">Số điện thoại</FieldLabel>
        <input
          id="phone"
          name="phone"
          defaultValue={employee.phone ?? ""}
          className={inputClass}
        />
        <FieldDescription>Số liên hệ của nhân viên.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="position">Vị trí</FieldLabel>
        <input
          id="position"
          name="position"
          defaultValue={employee.position ?? ""}
          className={inputClass}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="note">Ghi chú</FieldLabel>
        <textarea
          id="note"
          name="note"
          rows={3}
          defaultValue={employee.note ?? ""}
          className={inputClass}
        />
      </Field>
      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
      <SubmitButton>Lưu thay đổi</SubmitButton>
    </form>
  )
}
