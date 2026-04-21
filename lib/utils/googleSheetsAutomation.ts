/**
 * Extract Google Spreadsheet ID from a full URL or return the string if already an ID.
 */
export function parseGoogleSpreadsheetId(input: string): string {
  const s = input.trim();

  if (!s) return "";
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

  if (m) return m[1];

  return s;
}

/** Default column templates for appointment batch → Sheet row (matches extract JSON example keys).
 * Include {{meeting_link}} only when the Sheet step runs after “Create MeetAssistant link” in the flow. */
export const DEFAULT_APPOINTMENT_SHEET_COLUMNS = [
  "{{contact.name}}",
  "{{contact.email}}",
  "{{contact.phone}}",
  "{{extracted.date}}",
  "{{extracted.time}}",
  "{{extracted.appointment_booked}}",
  "{{extracted.confidence}}",
  "{{meeting_link}}",
];

/** Strip wrapping quotes from a sheet name segment if present. */
function unquoteGoogleSheetNameSegment(segment: string): string {
  const t = segment.trim();

  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).replace(/''/g, "'");
  }

  return t;
}

/**
 * Sheet name segment for Google Sheets A1 ranges. Quotes when the name has spaces,
 * punctuation, or other characters that break parsing (fixes "Unable to parse range").
 */
export function quoteGoogleSheetNameForA1(name: string): string {
  const n = unquoteGoogleSheetNameSegment(name).trim() || "Sheet1";
  const needsQuote = /[^A-Za-z0-9_]/.test(n) || /^(\d|true|false)$/i.test(n);

  if (!needsQuote) return n;

  return `'${n.replace(/'/g, "''")}'`;
}

/**
 * Build a valid append range (tab + cells). Re-quotes the sheet name when needed.
 */
export function formatGoogleSheetAppendRange(
  sheetTab: string | undefined,
  explicitRange: string | undefined,
  defaultCols = "A:Z",
): string {
  const r = (explicitRange && explicitRange.trim()) || "";

  if (r.includes("!")) {
    const bang = r.lastIndexOf("!");
    const sheetRaw = r.slice(0, bang);
    const cells = r.slice(bang + 1).trim() || defaultCols;

    return `${quoteGoogleSheetNameForA1(sheetRaw)}!${cells}`;
  }
  if (r && !r.includes("!")) {
    const tab = sheetTab?.trim() || "Sheet1";

    return `${quoteGoogleSheetNameForA1(tab)}!${r}`;
  }
  const tab = sheetTab?.trim() || "Sheet1";

  return `${quoteGoogleSheetNameForA1(tab)}!${defaultCols}`;
}

/** Sheet name from `Tab!A:Z`, `'My Tab'!A1`, or a bare tab name. */
export function parseSheetNameFromRangeHint(range: string): string | undefined {
  const r = range.trim();

  if (!r) return undefined;
  if (r.includes("!")) {
    return unquoteGoogleSheetNameSegment(r.slice(0, r.lastIndexOf("!")));
  }

  return unquoteGoogleSheetNameSegment(r);
}

/** Match user-configured tab to actual spreadsheet titles (case-insensitive), else first tab. */
export function pickMatchingSheetTitle(
  preferred: string | undefined,
  titles: string[],
): string {
  if (titles.length === 0) {
    throw new Error("Spreadsheet has no worksheets");
  }
  const p = preferred?.trim();

  if (p) {
    if (titles.includes(p)) return p;
    const pl = p.toLowerCase();
    const hit = titles.find((t) => t.toLowerCase() === pl);

    if (hit) return hit;
  }

  return titles[0];
}
