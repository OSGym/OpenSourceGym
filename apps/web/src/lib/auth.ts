import { createAuthClient } from "better-auth/react";
import type { MyProfile } from "@opengym/shared";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
});

export type SessionUser = MyProfile;

export function useSessionUser() {
  const { data, isPending, refetch } = authClient.useSession();
  return {
    user: (data?.user as unknown as SessionUser | undefined) ?? null,
    isPending,
    refetch,
  };
}
