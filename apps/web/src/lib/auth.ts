import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
});

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "staff" | "member";
  mustChangePassword: boolean;
  /** MFA (iki aşamalı doğrulama) etkin mi — Faz 5 */
  twoFactorEnabled: boolean;
}

export function useSessionUser() {
  const { data, isPending, refetch } = authClient.useSession();
  return {
    user: (data?.user as unknown as SessionUser | undefined) ?? null,
    isPending,
    refetch,
  };
}
