import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { env, allowedManagerEmails, isManagerEmailAllowed } from "@/env";

/**
 * One line at cold start so production allowlist problems can be checked from
 * the Vercel runtime logs without touching a shell. Never log secrets here.
 */
console.log(
  "[auth] config",
  JSON.stringify({
    nodeEnv: process.env.NODE_ENV,
    betterAuthUrl: env.BETTER_AUTH_URL,
    googleConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    allowlistCount: allowedManagerEmails.length,
    allowlist: allowedManagerEmails,
    rawAllowlistEnv: env.ALLOWED_MANAGER_EMAILS ?? "",
    authBypass: env.AUTH_BYPASS,
  }),
);

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg" }),
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "manager",
        input: false,
      },
      phone: { type: "string", required: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          assertAllowed(newUser.email, "user.create");

          // First user in the system becomes admin.
          const [{ value: existing }] = await db
            .select({ value: count() })
            .from(userTable);

          return {
            data: { ...newUser, role: existing === 0 ? "admin" : "manager" },
          };
        },
      },
    },
    session: {
      create: {
        /**
         * Re-check the allowlist on every sign-in, not just on account
         * creation. Otherwise removing someone from ALLOWED_MANAGER_EMAILS
         * after they leave the company would not actually lock them out —
         * their existing user row would keep letting them back in.
         */
        before: async (newSession) => {
          const owner = await db.query.user.findFirst({
            where: eq(userTable.id, newSession.userId),
            columns: { email: true },
          });
          if (owner) {
            assertAllowed(owner.email, "session.create");
          } else {
            // Should not happen: Better Auth only creates sessions for users
            // that exist. Log it so a mismatch is visible in production.
            console.error(
              `[auth] session.create: no user row for userId=${newSession.userId}`,
            );
          }
          return { data: newSession };
        },
      },
    },
  },
  plugins: [nextCookies()],
});

function assertAllowed(
  email: string,
  source: "user.create" | "session.create",
) {
  const attempted = (email ?? "").trim().toLowerCase();

  if (isManagerEmailAllowed(email)) {
    console.log(`[auth] allow (${source}): ${attempted}`);
    return;
  }

  // The client only gets a generic 403; the detail needed to fix the env is
  // here. Shows the exact attempted address, the parsed allowlist and the raw
  // env string (so stray quotes/spaces/newlines are visible).
  console.error(
    `[auth] DENY (${source}): "${attempted}" is not in ALLOWED_MANAGER_EMAILS`,
    JSON.stringify({
      attempted,
      nodeEnv: process.env.NODE_ENV,
      allowlistCount: allowedManagerEmails.length,
      allowlist: allowedManagerEmails,
      rawAllowlistEnv: env.ALLOWED_MANAGER_EMAILS ?? "",
      emptyAllowlistInProd:
        allowedManagerEmails.length === 0 &&
        process.env.NODE_ENV === "production",
    }),
  );

  throw new APIError("FORBIDDEN", {
    message: "Tài khoản này chưa được cấp quyền truy cập cổng quản lý.",
  });
}

export type Session = typeof auth.$Infer.Session;
