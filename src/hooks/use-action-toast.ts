"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { ActionResultState } from "@/lib/action-state"

/**
 * Ties a form action's lifecycle to sonner: a spinning "đang xử lý" toast
 * while it runs, replaced by success or the error message afterwards. When
 * the action returns `redirectTo` (and `redirect` is set) it navigates there
 * after the success toast.
 */
export function useActionToast(
  state: ActionResultState,
  pending: boolean,
  {
    id,
    successMessage,
    loadingMessage = "Đang xử lý…",
    redirect = false,
  }: {
    id: string
    successMessage: string
    loadingMessage?: string
    redirect?: boolean
  }
) {
  const router = useRouter()

  useEffect(() => {
    if (pending) {
      toast.loading(loadingMessage, { id })
      return
    }
    if (state?.error) {
      toast.error(state.error, { id })
      return
    }
    if (state?.success) {
      toast.success(successMessage, { id })
      if (redirect && state.redirectTo) router.push(state.redirectTo)
    }
  }, [
    pending,
    state,
    id,
    successMessage,
    loadingMessage,
    redirect,
    router,
  ])
}
