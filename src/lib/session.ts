import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type Session } from "@/lib/auth";
import { isDevAuthBypassed } from "@/env";

/** Fake user handed out when AUTH_BYPASS is on; admin so every page works. */
const DEV_USER = {
  id: "dev-user",
  name: "Dev User",
  email: "dev@local",
  role: "admin",
} as unknown as Session["user"];

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Use at the top of every portal server component / server action. Redirects
 * to /login when there is no session (unless AUTH_BYPASS is on in dev).
 */
export async function requireUser() {
  const session = await getSession();
  if (!session) {
    if (isDevAuthBypassed()) return DEV_USER;
    redirect("/login");
  }
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
