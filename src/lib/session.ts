import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth, type Session } from "@/lib/auth";
import { isDevAuthBypassed } from "@/env";

/** Fake user handed out when AUTH_BYPASS is on; admin so every page works. */
const DEV_USER = {
  id: "dev-user",
  name: "Dev User",
  email: "dev@local",
  role: "admin",
} as unknown as Session["user"];

/**
 * The bypassed session still has to exist as a real `user` row: every action
 * writes `created_by`, which is a foreign key to `user.id`. Without this the
 * first insert (e.g. adding an employee) fails with a FK violation.
 */
let devUserEnsured: Promise<void> | null = null;

function ensureDevUser() {
  devUserEnsured ??= db
    .insert(user)
    .values({
      id: DEV_USER.id,
      name: DEV_USER.name,
      email: DEV_USER.email,
      emailVerified: true,
      role: "admin",
    })
    .onConflictDoNothing()
    .then(() => undefined)
    .catch((err) => {
      // Let the next request retry if the DB was briefly unavailable.
      devUserEnsured = null;
      throw err;
    });
  return devUserEnsured;
}

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
    if (isDevAuthBypassed()) {
      await ensureDevUser();
      return DEV_USER;
    }
    redirect("/login");
  }
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
