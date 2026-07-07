'use client';

/**
 * Client-side Excel helpers built on SheetJS (xlsx). All spreadsheet work
 * happens in the browser — the API only ever exchanges JSON.
 */

import * as XLSX from 'xlsx';

/** Build a worksheet from an array of records and trigger a download. */
export function exportRows(
  rows: Record<string, string | number | null | undefined>[],
  filename: string,
  sheetName = 'Rapor',
): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/** `komuta-rapor-2026-07-07.xlsx` style filenames. */
export function timestampedName(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}

/* ----------------------------------------------------- import parsing --- */

/** Header aliases (Turkish + English), matched case-insensitively. */
const DATE_ALIASES = ['tarih', 'date', 'dob', 'gün', 'gun'];
const CODE_ALIASES = ['mağaza kodu', 'magaza kodu', 'mağaza', 'magaza', 'storeid', 'store id', 'store code', 'store', 'kod', 'code', 'şube kodu', 'sube kodu', 'şube', 'sube'];
const AMOUNT_ALIASES = ['ciro', 'tutar', 'amount', 'revenue', 'total', 'toplam'];

export interface ParsedImportRow {
  date: string;
  storeCode: string;
  amount: string;
  warnings: string[];
}

function normHeader(h: string): string {
  return String(h).trim().toLowerCase();
}

function matchColumn(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map(normHeader);
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx >= 0) return headers[idx];
  }
  // Fall back to a partial (contains) match.
  for (let i = 0; i < normalized.length; i++) {
    if (aliases.some((a) => normalized[i].includes(a))) return headers[i];
  }
  return null;
}

/** Convert an Excel serial number to a JS Date (1900 date system). */
function excelSerialToDate(serial: number): Date {
  // Excel epoch starts 1899-12-30 (accounts for the 1900 leap-year bug).
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Normalize a variety of date inputs to `YYYY-MM-DD`, or '' if unparseable. */
export function normalizeDate(value: unknown): string {
  if (value == null || value === '') return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }

  // Excel serial date (a bare number, roughly between 1970 and 2100).
  if (typeof value === 'number' && Number.isFinite(value) && value > 59 && value < 80000) {
    const d = excelSerialToDate(value);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
  }

  const s = String(value).trim();
  if (!s) return '';

  // Already ISO: YYYY-MM-DD (optionally with time).
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // dd.mm.yyyy or dd/mm/yyyy or dd-mm-yyyy.
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${pad2(Number(m))}-${pad2(Number(d))}`;
  }

  // Last resort: let the engine try.
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }
  return '';
}

/** Turn any amount cell into a fixed 2dp string, or '' if unparseable. */
export function normalizeAmount(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);

  let s = String(value).trim().replace(/[^\d.,-]/g, '');
  if (!s) return '';

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // The rightmost separator is the decimal one.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Comma is the decimal separator (Turkish style).
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : '';
}

export interface ParseResult {
  rows: ParsedImportRow[];
  detected: { date: string | null; code: string | null; amount: string | null };
  headers: string[];
}

/** Parse an uploaded workbook file into normalized import rows. */
export async function parseWorkbook(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const records: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  const dateCol = matchColumn(headers, DATE_ALIASES);
  const codeCol = matchColumn(headers, CODE_ALIASES);
  const amountCol = matchColumn(headers, AMOUNT_ALIASES);

  const rows: ParsedImportRow[] = records.map((rec) => {
    const rawDate = dateCol ? rec[dateCol] : '';
    const rawCode = codeCol ? rec[codeCol] : '';
    const rawAmount = amountCol ? rec[amountCol] : '';

    const date = normalizeDate(rawDate);
    const storeCode = String(rawCode ?? '').trim();
    const amount = normalizeAmount(rawAmount);

    const warnings: string[] = [];
    if (!date) warnings.push('Tarih okunamadı');
    if (!storeCode) warnings.push('Mağaza kodu eksik');
    if (!amount) warnings.push('Tutar okunamadı');

    return { date, storeCode, amount, warnings };
  });

  return { rows, detected: { date: dateCol, code: codeCol, amount: amountCol }, headers };
}

/** Download an empty 3-column template with Turkish headers. */
export function downloadImportTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([['Tarih', 'Mağaza Kodu', 'Ciro']]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
  XLSX.writeFile(wb, 'komuta-ciro-sablon.xlsx');
}
