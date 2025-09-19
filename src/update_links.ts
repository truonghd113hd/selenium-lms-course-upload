import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const OUTPUT_GLOB = /^file_links_output_.*\.csv$/;
const MAIN_FILE = 'file_links.csv';
const WORKSPACE = path.resolve(__dirname, '..');

interface LinkRow {
  Index: string;
  FilePath: string;
  FileName: string;
  ParentFolders: string;
  UUID: string;
  DownloadLink: string;
  Status: string;
}

function readCsvSync(filePath: string): LinkRow[] {
  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
  });
}

function writeCsvSync(filePath: string, rows: LinkRow[]) {
  const output = stringify(rows, { header: true });
  fs.writeFileSync(filePath, output, 'utf8');
}

function main() {
  // Read main file
  const mainFilePath = path.join(WORKSPACE, MAIN_FILE);
  let mainRows: LinkRow[] = readCsvSync(mainFilePath);
  const mainIndexMap = new Map(mainRows.map(row => [row.Index, row]));

  // Find all output files
  const files = fs.readdirSync(WORKSPACE).filter(f => OUTPUT_GLOB.test(f));
  for (const file of files) {
    const filePath = path.join(WORKSPACE, file);
    const rows: LinkRow[] = readCsvSync(filePath);
    for (const row of rows) {
      const mainRow = mainIndexMap.get(row.Index);
      if (mainRow) {
        mainRow.UUID = row.UUID;
        mainRow.DownloadLink = row.DownloadLink;
        mainRow.Status = row.Status;
      }
    }
  }
  writeCsvSync(mainFilePath, mainRows);
  console.log('Update completed.');
}

main();
