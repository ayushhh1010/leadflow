import type { NewLead } from "./types";

// Same rules as the API (backend/app/schemas.py) so most mistakes never leave the browser.
export const LIMITS = { name: 120, company: 120, phone: 40, note: 5000 } as const;

const PHONE_CHARS = /^[0-9+().\-\s]+$/;

export type LeadFormErrors = Partial<Record<keyof NewLead, string>>;

export function validateLead(input: NewLead): LeadFormErrors {
  const errors: LeadFormErrors = {};
  const name = input.name.trim();
  const phone = input.phone?.trim() ?? "";

  if (!name) errors.name = "Enter the lead's name.";
  else if (name.length > LIMITS.name)
    errors.name = `Keep the name under ${LIMITS.name} characters.`;

  if ((input.company?.trim().length ?? 0) > LIMITS.company) {
    errors.company = `Keep the company under ${LIMITS.company} characters.`;
  }

  if (phone) {
    const digits = phone.replace(/\D/g, "").length;
    if (!PHONE_CHARS.test(phone) || digits < 3) {
      errors.phone = "Use digits, spaces and + ( ) - . only.";
    } else if (phone.length > LIMITS.phone) {
      errors.phone = `Keep the phone under ${LIMITS.phone} characters.`;
    }
  }
  return errors;
}
