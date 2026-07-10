import { parsePhoneNumberWithError } from "libphonenumber-js/max";

export const INVALID_PHONE_MESSAGE =
  "Geçerli bir telefon numarası girin. Türkiye numaralarında ülke kodu zorunlu değildir.";
export const PHONE_ALREADY_EXISTS_MESSAGE =
  "Bu telefon numarasıyla kayıtlı bir hesap zaten var.";
export const PHONE_ALREADY_EXISTS_CODE = "PHONE_ALREADY_EXISTS";

export class InvalidPhoneNumberError extends Error {
  constructor() {
    super(INVALID_PHONE_MESSAGE);
    this.name = "InvalidPhoneNumberError";
  }
}

/**
 * Ülke kodu bulunmayan numaraları Türkiye numarası olarak yorumlar ve geçerli
 * telefonları E.164 biçiminde döndürür. Girdinin tamamı telefon olmalıdır;
 * metin içinden numara ayıklanmaz ve dahili numaralar (extension) kabul edilmez.
 */
export function normalizePhoneToE164(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidPhoneNumberError();
  }

  try {
    const phone = parsePhoneNumberWithError(value.trim(), {
      defaultCountry: "TR",
      extract: false,
    });

    if (!phone.isValid() || phone.ext) {
      throw new InvalidPhoneNumberError();
    }

    return phone.number;
  } catch (error) {
    if (error instanceof InvalidPhoneNumberError) throw error;
    throw new InvalidPhoneNumberError();
  }
}

/** Admin araması ve eski belgelerin güvenli okunması için hata atmayan sürüm. */
export function tryNormalizePhoneToE164(value: unknown): string | null {
  try {
    return normalizePhoneToE164(value);
  } catch (error) {
    if (error instanceof InvalidPhoneNumberError) return null;
    throw error;
  }
}

export function maskPhoneE164(phoneE164: string): string {
  if (phoneE164.length <= 7) return phoneE164;
  return `${phoneE164.slice(0, 3)}${"*".repeat(phoneE164.length - 7)}${phoneE164.slice(-4)}`;
}
