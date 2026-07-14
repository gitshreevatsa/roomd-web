import Credentials from "next-auth/providers/credentials";
import { getUserByEmail } from "@/lib/redis";
import { verifyPassword } from "@/lib/password";

export const emailProvider = Credentials({
  id: "email",
  name: "Email",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    const email = (credentials?.email as string) ?? "";
    const password = (credentials?.password as string) ?? "";
    if (!email || !password) return null;

    const user = await getUserByEmail(email.toLowerCase().trim());
    if (!user?.passwordHash) return null;

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return null;

    return {
      id: user.id,
      teamId: user.teamId,
      email: user.email ?? null,
      name: user.name ?? null,
    };
  },
});
