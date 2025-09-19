import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

export interface LinkRow {
  Index: string;
  FilePath: string;
  FileName: string;
  ParentFolders: string;
  UUID: string;
  DownloadLink: string;
  Status: string;
  NewFileName?: string;
  CourseName?: string;
  LessonName?: string;
}

export function readLinksCsv(): LinkRow[] {
  console.log("[readLinksCsv] Reading file_links.csv");
  const filePath = path.resolve(__dirname, "../file_links.csv");
  const content = fs.readFileSync(filePath, "utf8");
  const rows: LinkRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
  });
  console.log(`[readLinksCsv] Read ${rows.length} rows`);
  return rows;
}

export function updateLinksCsv(rows: LinkRow[]) {
  console.log(`[updateLinksCsv] Writing ${rows.length} rows to new_file_links.csv`);
  const filePath = path.resolve(__dirname, "../new_file_links.csv");
  const output = stringify(rows, { header: true });
  fs.writeFileSync(filePath, output, "utf8");
}

export function updateLinkCsv(row: LinkRow) {
  console.log(`[updateLinkCsv] Updating row with Index ${row.Index}`);
  const filePath = path.resolve(__dirname, "../file_links.csv");
  const rows = readLinksCsv();
  const index = rows.findIndex((r) => r.Index === row.Index);
  if (index !== -1) {
    rows[index] = row;
    const output = stringify(rows, { header: true });
    fs.writeFileSync(filePath, output, "utf8");
    console.log(`[updateLinkCsv] Row updated`);
  } else {
    console.log(`[updateLinkCsv] Row with Index ${row.Index} not found`);
  }
}
