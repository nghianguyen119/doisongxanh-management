/**
 * State returned by the portal form actions that are consumed with
 * `useActionState`. Validation failures are returned (not thrown) because
 * production redacts thrown server-action errors.
 */
/** Server action consumed with `useActionState` (or called directly). */
export type ActionStateFn = (
  state: ActionResultState,
  formData: FormData,
) => Promise<ActionResultState>;

export type ActionResultState = {
  error?: string;
  success?: boolean;
  /**
   * The change was saved but something secondary did not go through — e.g. the
   * Zalo notification could not be delivered. Shows a warning toast instead of
   * the green success one.
   */
  warning?: string;
  redirectTo?: string;
} | null;
