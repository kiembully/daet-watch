import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";

import { DEMO_LOGIN_ENABLED } from "@/lib/env";
import { findOrCreateUser } from "@/lib/users";
import type { Role } from "@/lib/rules";

const providers: NextAuthConfig["providers"] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
  providers.push(
    Facebook({
      clientId: process.env.AUTH_FACEBOOK_ID,
      clientSecret: process.env.AUTH_FACEBOOK_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

/**
 * Phone sign-in. There is no OTP yet — the field is captured because the schema
 * needs it, and because OTP is a drop-in upgrade: verify the code here and the
 * rest of the flow does not change. Off unless ENABLE_DEMO_LOGIN=1.
 */
if (DEMO_LOGIN_ENABLED) {
  providers.push(
    Credentials({
      id: "phone",
      name: "Phone number",
      credentials: { phone: { label: "Mobile number", type: "tel" } },
      async authorize(raw) {
        const phone = String(raw?.phone ?? "").replace(/[^\d]/g, "");
        if (phone.length !== 11 || !phone.startsWith("09")) return null;
        const user = await findOrCreateUser({ phone, name: null, email: null, image: null });
        if (!user) return null;
        // `phone` rides along because a credentials user carries no email, and the
        // jwt callback resolves the database row by whichever credential exists.
        return { id: String(user._id), name: user.displayAlias || "Neighbor", email: null, phone };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // In production a real secret is mandatory; locally a fixed fallback keeps
  // `npm run dev` from demanding one before anything can be opened.
  secret:
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV !== "production" ? "daet-watch-local-dev-secret" : undefined),
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login", error: "/login" },
  providers,
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const dbUser = await findOrCreateUser({
          email: user.email ?? null,
          phone: (user as { phone?: string | null }).phone ?? null,
          name: user.name ?? null,
          image: user.image ?? null,
        });
        // An OAuth provider's id is not our document id; the database row is the
        // only trustworthy source of the role and the alias.
        token.uid = dbUser ? String(dbUser._id) : String(user.id ?? token.sub ?? "");
        token.role = dbUser?.role ?? "resident";
        token.alias = dbUser?.displayAlias ?? "";
        return token;
      }

      // A moderator promoted by hand in the database should not have to sign out.
      if (trigger === "update" && typeof token.uid === "string") {
        const { User } = await import("@/models/user");
        const fresh = await User.findById(token.uid).lean<{ role: Role; displayAlias: string }>();
        if (fresh) {
          token.role = fresh.role;
          token.alias = fresh.displayAlias;
        }
      }
      return token;
    },
    async session({ session, token }) {
      const claims = token as unknown as { uid?: string; role?: Role; alias?: string };
      if (claims.uid) {
        session.user.id = claims.uid;
        session.user.role = claims.role ?? "resident";
        session.user.displayAlias = claims.alias ?? "";
      }
      return session;
    },
  },
});
