/** Normalize to digits only for matching CSV row to dial result. */
export function normalizePhoneDigits(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

export interface BatchRecipientRow {
  phone_number: string;
  name?: string;
  email?: string;
}

/**
 * Find the recipient row from the uploaded batch file (Mongo BatchCall.recipients).
 */
export function findRecipientByPhoneInBatch(
  recipients: BatchRecipientRow[],
  phone: string,
): BatchRecipientRow | null {
  if (!recipients?.length || !phone) return null;
  const target = normalizePhoneDigits(phone);
  if (!target) return null;
  const found = recipients.find(
    (r) => normalizePhoneDigits(r.phone_number || '') === target,
  );
  return found || null;
}
