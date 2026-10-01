// Batch mode: one plan with {{column}} placeholders + a CSV with one row per video.
// Placeholders can be used in any text of the plan (title, on-screen text, voiceovers, list items).

export interface Csv {
  headers: string[];
  rows: Record<string, string>[];
}

// RFC 4180 CSV: commas, double quotes ("" inside quotes), newlines inside quotes, CRLF or LF.
export function parseCsv(text: string): Csv {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  const src = text.replace(/^﻿/, ""); // Excel's byte-order mark
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += ch;
  }
  if (quoted) throw new Error("the CSV has an unclosed quote");
  if (field !== "" || record.length) {
    record.push(field);
    records.push(record);
  }
  const nonEmpty = records.filter((r) => r.some((f) => f.trim() !== ""));
  if (!nonEmpty.length) throw new Error("the CSV is empty");
  const headers = nonEmpty[0].map((h) => h.trim());
  const dupes = headers.filter((h, i) => h && headers.indexOf(h) !== i);
  if (dupes.length) throw new Error(`the CSV repeats the column${dupes.length > 1 ? "s" : ""} ${[...new Set(dupes)].join(", ")}`);
  const rows = nonEmpty.slice(1).map((r, n) => {
    if (r.length > headers.length && r.slice(headers.length).some((f) => f.trim())) throw new Error(`row ${n + 2} has more values than there are columns`);
    return Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]));
  });
  return { headers, rows };
}

const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;

// Every {{name}} used in the plan's strings.
export function findPlaceholders(value: unknown): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") for (const m of v.matchAll(PLACEHOLDER)) found.add(m[1]);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return [...found];
}

// The plan with {{name}} replaced by the row's values, in every string except file references.
export function fillPlan<T>(plan: T, row: Record<string, string>): T {
  const fill = (v: unknown, key?: string): unknown => {
    if (typeof v === "string") return key === "file" || key === "logoUrl" ? v : v.replace(PLACEHOLDER, (_, name: string) => row[name] ?? "");
    if (Array.isArray(v)) return v.map((x) => fill(x));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x, k)]));
    return v;
  };
  return fill(plan) as T;
}

export interface BatchRow<T> {
  row: number; // 1-based data row (the CSV line is row + 1)
  values: Record<string, string>;
  plan: T;
}

// Checks that the CSV has a column for every placeholder, then fills one plan per row.
export function batchPlans<T>(plan: T, csv: Csv, maxRows = 200): BatchRow<T>[] {
  const needed = findPlaceholders(plan);
  if (!needed.length) throw new Error("the plan has no {{column}} placeholders; put e.g. {{name}} in its text");
  const missing = needed.filter((n) => !csv.headers.includes(n));
  if (missing.length) throw new Error(`the CSV has no column for ${missing.map((m) => `{{${m}}}`).join(", ")} (columns: ${csv.headers.join(", ")})`);
  if (!csv.rows.length) throw new Error("the CSV has a header row but no data rows");
  if (csv.rows.length > maxRows) throw new Error(`the CSV has ${csv.rows.length} rows; the limit is ${maxRows} per batch`);
  return csv.rows.map((values, i) => {
    const empty = needed.filter((n) => !values[n]);
    if (empty.length) throw new Error(`row ${i + 1} has no value for ${empty.join(", ")}`);
    return { row: i + 1, values, plan: fillPlan(plan, values) };
  });
}
