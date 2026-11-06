import Papa from 'papaparse';
import { findBank } from './banks';

export interface ParsedRow {
  row: number;
  beneficiaryId?: string;
  accountNumber: string;
  bankCode: string;
  name: string;
  /** kobo */
  amount: number;
}

export interface ParseIssue { row: number; message: string }

export interface ParseResult {
  rows: ParsedRow[];
  issues: ParseIssue[];
  columns: string[];
}

const ALIASES: Record<keyof Omit<ParsedRow, 'row'>, string[]> = {
  beneficiaryId: ['beneficiary_id', 'id', 'staff_id', 'pension_id', 'ippis', 'reference', 'ref', 'beneficiaryid'],
  accountNumber: ['account_number', 'account_no', 'acct_no', 'account', 'nuban', 'accountnumber', 'acc_no'],
  bankCode: ['bank_code', 'bank', 'bank_name', 'bankcode', 'sort_code', 'institution'],
  name: ['account_name', 'name', 'beneficiary_name', 'full_name', 'beneficiary', 'accountname'],
  amount: ['amount', 'amount_ngn', 'net_pay', 'net_amount', 'value', 'naira'],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function mapColumns(headers: string[]) {
  const map: Partial<Record<keyof typeof ALIASES, number>> = {};
  const normed = headers.map(norm);
  (Object.keys(ALIASES) as (keyof typeof ALIASES)[]).forEach((key) => {
    const idx = normed.findIndex((h) => ALIASES[key].includes(h));
    if (idx >= 0) map[key] = idx;
  });
  return map;
}

function toKobo(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : null;
  const s = String(v ?? '').replace(/[₦,\sNGN]/gi, '');
  if (!s || !/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

export function rowsToBatch(table: unknown[][]): ParseResult {
  const issues: ParseIssue[] = [];
  const nonEmpty = table.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (nonEmpty.length < 2) return { rows: [], issues: [{ row: 0, message: 'The file has no data rows.' }], columns: [] };
  const headers = nonEmpty[0].map((h) => String(h ?? ''));
  const map = mapColumns(headers);
  const missing = (['accountNumber', 'bankCode', 'name', 'amount'] as const).filter((k) => map[k] === undefined);
  if (missing.length) {
    return {
      rows: [], columns: headers,
      issues: [{ row: 1, message: `Missing required column(s): ${missing.map((m) => ALIASES[m][0]).join(', ')}. Download the template for the expected layout.` }],
    };
  }
  const rows: ParsedRow[] = [];
  nonEmpty.slice(1).forEach((r, i) => {
    const rowNo = i + 2;
    const cell = (k: keyof typeof ALIASES) => (map[k] === undefined ? '' : r[map[k] as number]);
    let acct = String(cell('accountNumber') ?? '').replace(/\D/g, '');
    if (acct.length > 0 && acct.length < 10) acct = acct.padStart(10, '0');
    const bank = findBank(String(cell('bankCode') ?? ''));
    const name = String(cell('name') ?? '').trim().replace(/\s+/g, ' ');
    const amount = toKobo(cell('amount'));
    const errs: string[] = [];
    if (acct.length !== 10) errs.push('account number must be 10 digits');
    if (!bank) errs.push(`unrecognised bank "${cell('bankCode')}"`);
    if (!name) errs.push('account name is blank');
    if (amount === null) errs.push('amount is not a valid number');
    else if (amount <= 0) errs.push('amount must be greater than zero');
    if (errs.length) { issues.push({ row: rowNo, message: errs.join('; ') }); return; }
    rows.push({
      row: rowNo,
      beneficiaryId: String(cell('beneficiaryId') ?? '').trim() || undefined,
      accountNumber: acct,
      bankCode: bank!.code,
      name,
      amount: amount!,
    });
  });
  return { rows, issues, columns: headers };
}

export async function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'xlsx') {
    const { default: readXlsxFile } = await import('read-excel-file');
    const table = await readXlsxFile(file);
    return rowsToBatch(table as unknown[][]);
  }
  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    const res = Papa.parse<string[]>(text, { skipEmptyLines: true });
    return rowsToBatch(res.data);
  }
  return { rows: [], columns: [], issues: [{ row: 0, message: 'Unsupported file type. Upload a .csv or .xlsx file.' }] };
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
