"use client"

import * as React from "react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { useActionToast } from "@/hooks/use-action-toast"
import type { ActionStateFn } from "@/lib/action-state"

/**
 * A `<form>` wired to a server action that returns {@link ActionResultState}.
 * Shows the sonner lifecycle (loading → success/error) for the submission.
 */
export function ActionForm({
  action,
  toastId,
  successMessage,
  loadingMessage,
  redirect = false,
  className,
  children,
}: {
  action: ActionStateFn
  toastId: string
  successMessage: string
  loadingMessage?: string
  /** Navigate to `state.redirectTo` after the success/warning toast. */
  redirect?: boolean
  className?: string
  children: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState(action, null)
  useActionToast(state, pending, {
    id: toastId,
    successMessage,
    loadingMessage,
    redirect,
  })

  return (
    <form action={formAction} className={className}>
      {children}
    </form>
  )
}

/** Submit button that disables and spins while its form is submitting. */
export function SubmitButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} {...props}>
      {children}
    </Button>
  )
}
