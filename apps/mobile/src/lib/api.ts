import { API_URL } from "./config";
import { authClient } from "./auth";
import { getDeviceFingerprint } from "./fingerprint";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const fp = await getDeviceFingerprint();
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Cookie: authClient.getCookie(),
      ...(fp ? { "X-Device-Fingerprint": fp } : {}),
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data as { message?: string }).message ?? `İstek başarısız (${res.status})`,
      (data as { code?: string }).code,
    );
  }
  return data as T;
}
