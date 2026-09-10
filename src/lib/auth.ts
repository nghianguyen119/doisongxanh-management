import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { allowedManagerEmails, env } from "@/env";

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
          const email = newUser.email.toLowerCase();

          // Allowlist gate. Empty list = allow anyone (first-run local setup).
          if (
            allowedManagerEmails.length > 0 &&
            !allowedManagerEmails.includes(email)
          ) {
            throw new APIError("FORBIDDEN", {
              message: "Tài khoản này chưa được cấp quyền truy cập cổng quản lý.",
            });
          }

          // First user in the system becomes admin.
          const [{ value: existing }] = await db
            .select({ value: count() })
            .from(userTable);

          return {
            data: {
              ...newUser,
              role: existing === 0 ? "admin" : "manager",
            },
          };
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

/** Promote an existing user to admin (used by the seed script). */
export async function makeAdmin(email: string) {
  await db
    .update(userTable)
    .set({ role: "admin" })
    .where(eq(userTable.email, email.toLowerCase()));
}
