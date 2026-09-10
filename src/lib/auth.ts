import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { env, isManagerEmailAllowed } from "@/env";

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
          assertAllowed(newUser.email);

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
          if (owner) assertAllowed(owner.email);
          return { data: newSession };
        },
      },
    },
  },
  plugins: [nextCookies()],
});

function assertAllowed(email: string) {
  if (isManagerEmailAllowed(email)) return;
  throw new APIError("FORBIDDEN", {
    message: "Tài khoản này chưa được cấp quyền truy cập cổng quản lý.",
  });
}

export type Session = typeof auth.$Infer.Session;
