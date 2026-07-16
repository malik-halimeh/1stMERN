// Dependency-free client-side data export helpers.
// Used by the admin dashboards to export exactly what is currently on screen
// (i.e. the active search/filter result), in formats real businesses use:
//   • CSV  — opens natively in Excel / Google Sheets (the ops/finance format)
//   • JSON — full-fidelity technical archive (keeps nested before/after payloads)
//
// No third-party libraries: everything is built from the browser's Blob + anchor
// download primitives, so it adds nothing to the bundle and can never break a build.

/** One CSV column: a header label and how to pull its string value from a row. */
export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string;
}

// Wrap a single CSV cell safely. A field that contains a comma, quote, or newline
// must be quoted, and any inner quote is doubled — that is the RFC-4180 rule Excel
// follows, so exports never shift columns when a value contains punctuation.
const csvCell = (raw: string): string => {
  const s = raw ?? '';
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

// Trigger a browser download for an in-memory Blob without leaving the page.
const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Release the object URL on the next tick so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/**
 * Export an array of rows to a CSV file that Excel opens correctly.
 * The leading ﻿ byte-order mark tells Excel the file is UTF-8, so accented
 * names and symbols (é, €, →) render properly instead of as mojibake.
 */
export function exportRowsToCsv<T>(
  filename: string,
  rows: T[],
  columns: ExportColumn<T>[]
): void {
  const headerLine = columns.map((c) => csvCell(c.header)).join(',');
  const bodyLines = rows.map((row) =>
    columns.map((c) => csvCell(c.value(row))).join(',')
  );
  const csv = '﻿' + [headerLine, ...bodyLines].join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

/** Export any serializable value to a pretty-printed JSON file. */
export function exportToJson(filename: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  downloadBlob(new Blob([json], { type: 'application/json;charset=utf-8;' }), filename);
}

/**
 * Build a safe, self-documenting filename, e.g.
 *   buildExportFilename('opticart-audit-logs', 'alex carter', 'csv')
 *   → 'opticart-audit-logs_alex-carter_2026-07-16.csv'
 * The active search term is baked into the name so an exported file always says
 * what it contains and when it was pulled.
 */
export function buildExportFilename(
  base: string,
  searchTerm: string,
  ext: string
): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const slug = searchTerm
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return [base, slug || 'all', date].filter(Boolean).join('_') + '.' + ext;
}
