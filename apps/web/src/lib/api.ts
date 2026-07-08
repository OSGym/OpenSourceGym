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
  const res = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "include",
    headers:
      options.body !== undefined
        ? { "Content-Type": "application/json" }
        : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.message ?? `İstek başarısız (${res.status})`,
      data.code,
    );
  }
  return data as T;
}

/**
 * BetterAuth uç noktaları (`/api/auth/*`) için yardımcı. `api()`'den farklı
 * olarak bunlar app'in kendi REST sözleşmesinde değil, BetterAuth'un kendi
 * endpoint şemasında; yine de aynı çerez tabanlı oturum ve hata biçimini
 * kullanır (Faz 5: MFA girişi/kurulumu).
 */
export async function authApi<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/auth${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.message ?? `İstek başarısız (${res.status})`,
      data.code,
    );
  }
  return data as T;
}
