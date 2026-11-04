import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb, schema } from "./db";
import { sendEmail } from "./email.server";

/**
 * Better Auth instance for one request. Email + password only; public sign-up is
 * closed at the HTTP layer (see routes/api.auth.$.ts). Accounts are created only
 * through a manager invitation or the one-time first-manager setup.
 */
export function createAuth(env: Env, request: Request) {
  const origin = new URL(request.url).origin;
  return betterAuth({
    appName: env.APP_NAME,
    baseURL: origin,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin, env.PUBLIC_BASE_URL],
    database: drizzleAdapter(createDb(env.DB), {
      provider: "sqlite",
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "contributor", input: false },
        status: { type: "string", required: false, defaultValue: "active", input: false },
        title: { type: "string", required: false, input: true },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, token }) => {
        const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
        await sendEmail(env, {
          to: user.email,
          subject: `Reset your ${env.APP_NAME} password`,
          text: `Use this link to choose a new password. It expires in one hour.\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
        });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: { enabled: true, window: 60, max: 30 },
    advanced: {
      useSecureCookies: origin.startsWith("https://"),
      database: { generateId: () => crypto.randomUUID() },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
