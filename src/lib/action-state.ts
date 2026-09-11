/**
 * State returned by the portal form actions that are consumed with
 * `useActionState`. Validation failures are returned (not thrown) because
 * production redacts thrown server-action errors.
 */
export type ActionResultState = {
  error?: string;
  success?: boolean;
  redirectTo?: string;
} | null;
