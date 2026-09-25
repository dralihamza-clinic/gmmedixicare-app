// Phone numbers are stored in E.164 ("+923001234567"), the format both the
// website's appointment form and this app's phone inputs produce. The "max"
// metadata build is used so validation checks real number ranges, not just
// the length.
import {
  isValidPhoneNumber,
  parsePhoneNumber,
  type Value as PhoneValue,
} from "react-phone-number-input/max";

export type { PhoneValue };

export const DEFAULT_PHONE_COUNTRY = "PK" as const;

// Inline error text for a phone input, or "" when the value is acceptable.
export function phoneError(value: PhoneValue | undefined, required = true): string {
  if (!value) return required ? "Enter a phone number." : "";
  if (!isValidPhoneNumber(value)) return "Enter a complete, valid phone number.";
  return "";
}

// Best-effort conversion of free-text input ("0300-1234567", "+92 300
// 1234567") to E.164, assuming Pakistan when there's no country code.
// Returns null if it isn't a valid number.
export function toE164(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const parsed = parsePhoneNumber(trimmed, DEFAULT_PHONE_COUNTRY);
    return parsed?.isValid() ? parsed.number : null;
  } catch {
    return null;
  }
}

// Spellings the same number may have been saved under: E.164 plus, for
// Pakistani numbers, the common local forms ("03001234567", "0300 1234567",
// "0300-1234567") used before phones were normalized. Lets Mark Done find
// older patients whose numbers were typed freehand.
export function phoneMatchVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const variants = new Set<string>(trimmed ? [trimmed] : []);
  try {
    const parsed = parsePhoneNumber(trimmed, DEFAULT_PHONE_COUNTRY);
    if (parsed?.isValid()) {
      variants.add(parsed.number);
      if (parsed.country === "PK") {
        const national = parsed.nationalNumber;
        variants.add(`0${national}`);
        variants.add(parsed.formatNational());
        if (national.length === 10) variants.add(`0${national.slice(0, 3)}-${national.slice(3)}`);
      }
    }
  } catch {
    // Not parseable: just the trimmed text.
  }
  return [...variants];
}

// Digits of a search query with leading zeros dropped, so "0300 123" matches
// the "300123" inside "+923001234567" as well as "0300-1234567".
export function searchDigits(query: string): string {
  return query.replace(/\D/g, "").replace(/^0+/, "");
}
