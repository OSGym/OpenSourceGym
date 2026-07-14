import type { ApiErrorCode, ApiErrorResponse } from "@opengym/shared";
import type { Response } from "express";

/** Tüm uygulama API hatalarında istemciler için kararlı bir code alanı üretir. */
export function sendApiError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
): void {
  const body: ApiErrorResponse = { code, message };
  res.status(status).json(body);
}
