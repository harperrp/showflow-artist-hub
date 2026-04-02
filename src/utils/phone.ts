// Utility for working with phone numbers on the client side.
//
// This helper mirrors the behaviour of the `normalizePhone` function used on
// the backend (`supabase/functions/_shared/whatsapp.ts`).  It strips any
// non‑digit characters from the provided phone string, ensuring that phone
// numbers are stored in a consistent format and preventing duplicate leads
// from being created due to differing formats (e.g. "(11) 9‑9999‑9999" vs
// "11999999999").  Passing `null` or `undefined` returns an empty string.

export function normalizePhone(phone?: string | null): string {
  return (phone ?? "").replace(/[^\d]/g, "");
}
