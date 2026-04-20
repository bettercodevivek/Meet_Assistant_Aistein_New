import * as XLSX from 'xlsx';

export interface ParsedRecipient {
  phone_number: string;
  name: string;
  email?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone_number?: string;
  dynamic_variables?: Record<string, unknown>;
}

function parseRecipientsFromCsvText(text: string): ParsedRecipient[] {
  const lines = text.split('\n').filter((line) => line.trim());
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const phone_numberIndex = headers.indexOf('phone_number');
  const phoneIndex = headers.indexOf('phone');
  const phoneColumnIndex = phone_numberIndex !== -1 ? phone_numberIndex : phoneIndex;

  if (phoneColumnIndex === -1) {
    throw new Error('CSV must include a phone_number or phone column');
  }

  const nameIndex = headers.indexOf('name');
  const emailIndex = headers.indexOf('email');
  const customerNameIndex = headers.indexOf('customer_name');
  const customerEmailIndex = headers.indexOf('customer_email');
  const customerPhoneNumberIndex = headers.indexOf('customer_phone_number');

  const rows: ParsedRecipient[] = [];

  for (let li = 1; li < lines.length; li++) {
    const values = lines[li].split(',').map((v) => v.trim());
    const phone = values[phoneColumnIndex] || '';
    if (!phone) continue;

    const rawName =
      (nameIndex !== -1 ? values[nameIndex] : '') ||
      (customerNameIndex !== -1 ? values[customerNameIndex] : '') ||
      '';
    const name = rawName.trim() || 'Contact';

    const rec: ParsedRecipient = {
      phone_number: phone,
      name,
    };

    if (emailIndex !== -1 && values[emailIndex]) rec.email = values[emailIndex];
    if (customerNameIndex !== -1 && values[customerNameIndex]) {
      rec.customer_name = values[customerNameIndex];
    }
    if (customerEmailIndex !== -1 && values[customerEmailIndex]) {
      rec.customer_email = values[customerEmailIndex];
    }
    if (customerPhoneNumberIndex !== -1 && values[customerPhoneNumberIndex]) {
      rec.customer_phone_number = values[customerPhoneNumberIndex];
    }

    rows.push(rec);
  }

  return rows;
}

/**
 * Reads CSV or Excel (.xlsx / .xls) and returns recipient rows.
 */
export async function parseRecipientsFromFile(file: File): Promise<ParsedRecipient[]> {
  const name = file.name.toLowerCase();
  const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');

  let text: string;
  if (isExcel) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const first = wb.SheetNames[0];
    if (!first) {
      throw new Error('Excel file has no sheets');
    }
    const sheet = wb.Sheets[first];
    text = XLSX.utils.sheet_to_csv(sheet);
  } else {
    text = await file.text();
  }

  return parseRecipientsFromCsvText(text);
}
