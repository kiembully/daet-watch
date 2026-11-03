import type { DefaultSession } from "next-auth";

import type { Role } from "@/lib/rules";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      displayAlias: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
    phone?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    alias?: string;
  }
}
