import { API_URL } from "./config";
import { authClient } from "./auth";

export async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Cookie: authClient.getCookie() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { message?: string }).message ?? `İstek başarısız (${res.status})`,
    );
  }
  return data as T;
}
